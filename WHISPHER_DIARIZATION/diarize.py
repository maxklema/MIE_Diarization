import argparse
import logging
import os
import re

import faster_whisper
import torch
import torchaudio

from ctc_forced_aligner import (
    generate_emissions,
    get_alignments,
    get_spans,
    load_alignment_model,
    postprocess_results,
    preprocess_text,
)
from deepmultilingualpunctuation import PunctuationModel
from nemo.collections.asr.models.msdd_models import NeuralDiarizer

from helpers import (
    cleanup,
    create_config,
    find_numeral_symbol_tokens,
    get_realigned_ws_mapping_with_punctuation,
    get_sentences_speaker_mapping,
    get_speaker_aware_transcript,
    get_words_speaker_mapping,
    langs_to_iso,
    process_language_arg,
    punct_model_langs,
    whisper_langs,
    write_srt,
)

mtypes = {"cpu": "int8", "cuda": "float16"}

# Initialize parser
parser = argparse.ArgumentParser()
parser.add_argument(
    "-a", "--audio", help="name of the target audio file", required=True
)
parser.add_argument(
    "--no-stem",
    action="store_false",
    dest="stemming",
    default=True,
    help="Disables source separation."
    "This helps with long files that don't contain a lot of music.",
)

parser.add_argument(
    "--suppress_numerals",
    action="store_true",
    dest="suppress_numerals",
    default=False,
    help="Suppresses Numerical Digits."
    "This helps the diarization accuracy but converts all digits into written text.",
)

parser.add_argument(
    "--whisper-model",
    dest="model_name",
    default="medium.en",
    help="name of the Whisper model to use",
)

parser.add_argument(
    "--batch-size",
    type=int,
    dest="batch_size",
    default=8,
    help="Batch size for batched inference, reduce if you run out of memory, "
    "set to 0 for original whisper longform inference",
)

parser.add_argument(
    "--language",
    type=str,
    default=None,
    choices=whisper_langs,
    help="Language spoken in the audio, specify None to perform language detection",
)

parser.add_argument(
    "--device",
    dest="device",
    default="cuda" if torch.cuda.is_available() else "cpu",
    help="if you have a GPU use 'cuda', otherwise 'cpu'",
)

args = parser.parse_args()
language = process_language_arg(args.language, args.model_name)

if args.stemming:
    # Isolate vocals from the rest of the audio

    return_code = os.system(
        f'python -m demucs.separate -n htdemucs --two-stems=vocals "{args.audio}" -o temp_outputs --device "{args.device}"'
    )

    if return_code != 0:
        logging.warning(
            "Source splitting failed, using original audio file. "
            "Use --no-stem argument to disable it."
        )
        vocal_target = args.audio
    else:
        vocal_target = os.path.join(
            "temp_outputs",
            "htdemucs",
            os.path.splitext(os.path.basename(args.audio))[0],
            "vocals.wav",
        )
else:
    vocal_target = args.audio


# Transcribe the audio file

whisper_model = faster_whisper.WhisperModel(
    args.model_name, device=args.device, compute_type=mtypes[args.device]
)
whisper_pipeline = faster_whisper.BatchedInferencePipeline(whisper_model)
audio_waveform = faster_whisper.decode_audio(vocal_target)
suppress_tokens = (
    find_numeral_symbol_tokens(whisper_model.hf_tokenizer)
    if args.suppress_numerals
    else [-1]
)

if args.batch_size > 0:
    transcript_segments, info = whisper_pipeline.transcribe(
        audio_waveform,
        language,
        suppress_tokens=suppress_tokens,
        batch_size=args.batch_size,
    )
else:
    transcript_segments, info = whisper_model.transcribe(
        audio_waveform,
        language,
        suppress_tokens=suppress_tokens,
        vad_filter=True,
    )

transcript_segments = list(transcript_segments)
print(f"[DEBUG] Number of segments: {len(transcript_segments)}")

full_transcript = "".join(segment.text for segment in transcript_segments)

# Print and save the Whisper segments for debugging
print("[DEBUG] Whisper segments:")
print(f"[DEBUG] Number of segments: {len(transcript_segments)}")
if not transcript_segments:
    print("[DEBUG] transcript_segments is empty.")
for segment in transcript_segments:
    print(segment)

# Save Whisper segments to file
if args.audio and transcript_segments:
    seg_file = f"{os.path.splitext(args.audio)[0]}_whisper_segments.txt"
    try:
        with open(seg_file, 'w', encoding='utf-8') as f:
            for segment in transcript_segments:
                f.write(f"{segment.start:.2f} --> {segment.end:.2f}: {segment.text.strip()}\n")
        print(f"[INFO] Whisper segments saved to {seg_file}")
    except Exception as e:
        logging.warning(f"Failed to save Whisper segments: {e}")

# clear gpu vram
del whisper_model, whisper_pipeline
torch.cuda.empty_cache()

# Forced Alignment
alignment_model, alignment_tokenizer = load_alignment_model(
    args.device,
    dtype=torch.float16 if args.device == "cuda" else torch.float32,
)

emissions, stride = generate_emissions(
    alignment_model,
    torch.from_numpy(audio_waveform)
    .to(alignment_model.dtype)
    .to(alignment_model.device),
    batch_size=args.batch_size,
)

del alignment_model
torch.cuda.empty_cache()

tokens_starred, text_starred = preprocess_text(
    full_transcript,
    romanize=True,
    language=langs_to_iso[info.language],
)

segments, scores, blank_token = get_alignments(
    emissions,
    tokens_starred,
    alignment_tokenizer,
)

spans = get_spans(tokens_starred, segments, blank_token)

word_timestamps = postprocess_results(text_starred, spans, stride, scores)


# convert audio to mono for NeMo combatibility
ROOT = os.getcwd()
temp_path = os.path.join(ROOT, "temp_outputs")
os.makedirs(temp_path, exist_ok=True)
torchaudio.save(
    os.path.join(temp_path, "mono_file.wav"),
    torch.from_numpy(audio_waveform).unsqueeze(0).float(),
    16000,
    channels_first=True,
)


# Initialize NeMo MSDD diarization model
msdd_model = NeuralDiarizer(cfg=create_config(temp_path)).to(args.device)
msdd_model.diarize()

del msdd_model
torch.cuda.empty_cache()

# Reading timestamps <> Speaker Labels mapping


speaker_ts = []
with open(os.path.join(temp_path, "pred_rttms", "mono_file.rttm"), "r") as f:
    lines = f.readlines()
    for line in lines:
        line_list = line.split(" ")
        s = int(float(line_list[5]) * 1000)
        e = s + int(float(line_list[8]) * 1000)
        speaker_ts.append([s, e, int(line_list[11].split("_")[-1])])

wsm = get_words_speaker_mapping(word_timestamps, speaker_ts, "start")

if info.language in punct_model_langs:
    # restoring punctuation in the transcript to help realign the sentences
    punct_model = PunctuationModel(model="kredor/punctuate-all")

    words_list = list(map(lambda x: x["word"], wsm))

    labled_words = punct_model.predict(words_list, chunk_size=230)

    ending_puncts = ".?!"
    model_puncts = ".,;:!?"

    # We don't want to punctuate U.S.A. with a period. Right?
    is_acronym = lambda x: re.fullmatch(r"\b(?:[a-zA-Z]\.){2,}", x)

    for word_dict, labeled_tuple in zip(wsm, labled_words):
        word = word_dict["word"]
        if (
            word
            and labeled_tuple[1] in ending_puncts
            and (word[-1] not in model_puncts or is_acronym(word))
        ):
            word += labeled_tuple[1]
            if word.endswith(".."):
                word = word.rstrip(".")
            word_dict["word"] = word

else:
    logging.warning(
        f"Punctuation restoration is not available for {info.language} language."
        " Using the original punctuation."
    )

wsm = get_realigned_ws_mapping_with_punctuation(wsm)
ssm = get_sentences_speaker_mapping(wsm, speaker_ts)

with open(f"{os.path.splitext(args.audio)[0]}.txt", "w", encoding="utf-8-sig") as f:
    get_speaker_aware_transcript(ssm, f)

with open(f"{os.path.splitext(args.audio)[0]}.srt", "w", encoding="utf-8-sig") as srt:
    write_srt(ssm, srt)

cleanup(temp_path)

# Visual debug: Plot word alignment timings
'''print(f"[DEBUG] Number of words in word_timestamps: {len(word_timestamps)}")
print(f"[DEBUG] Sample entry: {word_timestamps[0] if word_timestamps else 'None'}")
print("[DEBUG] Plotting word alignments...")
for word in word_timestamps:
    print(word)
import matplotlib.pyplot as plt

try:
    chunk_duration = 60  # seconds
    start_time = 0
    end_time = int(word_timestamps[-1]["end"] / 1000) + 1

    for chunk_start in range(start_time, end_time, chunk_duration):
        chunk_end = chunk_start + chunk_duration
        chunk_words = [
            w for w in word_timestamps 
            if chunk_start * 1000 <= w['start'] < chunk_end * 1000
        ]

        if not chunk_words:
            continue

        plt.figure(figsize=(18, 4))
        y_base = 1.0
        y_range = 0.15  # Space between horizontal levels

        for i, word_data in enumerate(chunk_words):
            start = word_data['start'] / 1000
            end = word_data['end'] / 1000
            word = word_data.get('text', word_data.get('word', ''))
            y_offset = (i % 5) * y_range
            plt.hlines(y=y_base + y_offset, xmin=start, xmax=end, color='blue', linewidth=6)
            plt.text((start + end) / 2, y_base + y_offset + 0.02, word,
                     rotation=45, ha='center', va='bottom', fontsize=7)

        plt.ylim(y_base - 0.1, y_base + y_range * 5)
        plt.xlabel('Time (s)')
        plt.title(f'Word Alignment Timeline: {chunk_start}s to {chunk_end}s')
        plt.tight_layout()
        filename = f"{os.path.splitext(args.audio)[0]}_alignment_debug_{chunk_start}_{chunk_end}.png"
        plt.savefig(filename)
        plt.close()

except Exception as e:
    logging.warning(f"Failed to generate alignment debug plots: {e}")
'''