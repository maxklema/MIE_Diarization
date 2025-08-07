FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    build-essential \
    cmake \
    libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

COPY whisper-diarization/requirements.txt whisper-diarization/constraints.txt ./
RUN pip install --upgrade pip && \
    pip install -c constraints.txt -r requirements.txt 

COPY whisper-diarization/. .

CMD ["python", "app.py"]