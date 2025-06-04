// src/components/ui/MicRecorder.jsx
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button"

const MicRecorderComponent = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    setAudioURL(null); // clear old audio
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-white shadow-md rounded-xl w-full max-w-md mx-auto">
      <h2 className="text-xl font-bold">Record Conversation To Summarize</h2>
      <div className="flex gap-4">
        <Button
          onClick={startRecording}
          disabled={isRecording}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Start Recording
        </Button>
        <Button
          onClick={stopRecording}
          disabled={!isRecording}
          className="bg-red-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Stop Recording
        </Button>
      </div>
      {audioURL && (
        <audio controls src={audioURL} className="mt-4 w-full rounded-md" />
      )}
    </div>
  );
};

export default MicRecorderComponent;