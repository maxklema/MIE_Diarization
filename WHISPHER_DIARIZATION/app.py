import os
import uuid
import subprocess
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

@app.route('/api/test', methods=['GET'])
def test():
    return jsonify({"message": "Backend is running!"})

@app.route('/api/diarize', methods=['POST'])
def diarize_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    # Generate a unique filename and save
    filename = f"{uuid.uuid4().hex}.webm"
    save_path = os.path.join("uploads", filename)
    os.makedirs("uploads", exist_ok=True)
    audio_file.save(save_path)

    try:
        result = subprocess.run(
            ['python3', 'diarize.py', '-a', os.path.join('uploads', filename)],
            capture_output=True,
            text=True,
            check=True
        )
        return jsonify({
            "message": "Diarization completed",
            "filename": filename,
            "output": result.stdout
        }), 200
    except subprocess.CalledProcessError as e:
        return jsonify({
            "error": "Diarization failed",
            "details": e.stderr
        }), 500

@app.route('/api/transcript/<filename>', methods=['GET'])
def get_transcript(filename):
    txt_filename = os.path.splitext(filename)[0] + ".txt"
    txt_path = os.path.join("uploads", txt_filename)

    if not os.path.exists(txt_path):
        return jsonify({"error": "Transcript not found"}), 404

    with open(txt_path, "r", encoding="utf-8") as f:
        content = f.read().lstrip('\ufeff')
    return jsonify({"transcript": content}), 200

if __name__ == '__main__':
    app.run(debug=True)