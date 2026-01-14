# livekit-speech - Real-time Voice Transcription

livekit-speech is a high-performance, real-time speech-to-text application built with React, LiveKit, and Faster-Whisper. It provides zero-cost transcription using local inference.

## 🚀 Features

- **Real-time Transcription**: Instant speech-to-text using local `faster-whisper`.
- **LiveKit Integration**: Robust WebRTC audio streaming via LiveKit Cloud.
- **Visual Feedback**: Real-time audio visualization and confidence scores.
- **Cost Efficient**: $0 API cost for transcription (runs locally).
- **Mobile Ready**: iOS/Android compatible via WebRTC.

## 🛠️ Tech Stack

| Component    | Technology       | Description                        |
| ------------ | ---------------- | ---------------------------------- |
| **Frontend** | React + Vite     | Fast, modern UI with TailwindCSS   |
| **Backend**  | FastAPI (Python) | High-performance Python API        |
| **Realtime** | LiveKit Cloud    | WebRTC infrastructure              |
| **ASR**      | faster-whisper   | Local, optimized Whisper inference |
| **State**    | TanStack Query   | Efficient server state management  |

## 🏗️ Architecture

```
Microphone -> LiveKit (WebRTC) -> Backend (FastAPI) -> Whisper (local) -> WebSocket -> Frontend (UI)
```

1.  **Frontend** captures audio via LiveKit SDK.
2.  **LiveKit Cloud** routes audio packets.
3.  **Backend** receives audio stream (via LiveKit server SDK).
4.  **Faster-Whisper** processes audio chunks locally (Int8 quantization).
5.  **WebSocket** pushes transcript segments back to the Client.

## ⚡ Performance

- **Latency**: Sub-second processing for short phrases.
- **Quality**: Noise gate and VAD (Voice Activity Detection) prevent hallucinations.
- **Compatibility**: Works on all modern browsers including Safari (iOS).

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/harshan-aiyappa/livekit-speech.git
    cd livekit-speech
    ```

2.  **Install dependencies**
    ```bash
    # Install Node.js dependencies
    npm install

    # Install Python dependencies
    pip install fastapi faster-whisper livekit-api python-dotenv python-multipart uvicorn websockets
    ```

3.  **Configure Environment**
    Create a `.env` file in the root:
    ```env
    LIVEKIT_URL=your_livekit_wss_url
    LIVEKIT_API_KEY=your_api_key
    LIVEKIT_API_SECRET=your_api_secret
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    This starts both the FastAPI backend (port 8000) and Vite frontend (port 5000).

## 📄 License

MIT
