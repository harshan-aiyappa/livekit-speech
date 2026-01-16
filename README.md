
# 🎙️ Vocalis - Real-Time Speech AI Platform

**Advanced Hybrid Speech-to-Text System using LiveKit, WebSockets, and Faster-Whisper.**

![Status](https://img.shields.io/badge/Status-Production%20Ready-green) 
![Model](https://img.shields.io/badge/Model-Whisper%20Small%20(int8)-blue)
![ASR](https://img.shields.io/badge/ASR-Faster--Whisper-orange)
![Latency](https://img.shields.io/badge/Latency-%3C500ms-brightgreen)

---

## 🚀 Overview

Vocalis is a high-performance speech recognition practice platform designed for real-time accuracy and low latency. It supports three distinct architectural modes to demonstrate different ASR strategies:

1.  **Agent Mode (Recommended):** Uses LiveKit WebRTC Data Channels for ultra-low latency (<300ms) and robust connectivity.
2.  **Direct Mode (WebSocket):** Pure P2P-style WebSocket streaming for simple, server-direct transcription.
3.  **Hybrid Mode:** Legacy approach combining LiveKit for rooms and WebSockets for data.

---

## ✨ Features

### 🎧 Core Capabilities
- **Real-time Transcription:** Powered by `faster-whisper` (Small model, int8 quantized).
- **Anti-Hallucination:** Advanced VAD (Voice Activity Detection) + Energy Gating (-40dB) + Text Filtering.
- **Multi-Language Support:** Over 30 languages (English, French, Spanish, Hindi, etc.) with auto-detection capability.
- **Smart System Checks:** Automated pre-flight checks for Microphone, Socket, and Backend health before session start.
- **Performance Metrics:** Real-time **Turnaround Time (TAT)** display in seconds.

### 📱 Mobile-First Experience
- **Responsive Design:** Fully optimized for Mobile (IOS/Android) and Desktop.
- **Secure Access:** Built-in support for **Ngrok** tunneling to test on mobile devices securely over HTTPS.
- **Touch-Friendly:** Large controls, haptic-style feedback, and visualizers.

---

## 🛠️ Architecture

**Frontend:** React (Vite) + TypeScript + TailwindCSS + Shadcn/UI + Vanta.js (Visuals)
**Backend:** Python (FastAPI) + Faster-Whisper + FFmpeg + LiveKit Server SDK

### Audio Pipeline
1.  **Capture:** `navigator.mediaDevices.getUserMedia` (Frontend)
2.  **Transport:** 
    *   *Agent Mode:* WebRTC Audio Track -> Python Worker
    *   *Direct Mode:* WebSocket Blob (WebM) -> Python Endpoint
3.  **Processing:** 
    *   VAD Filter (Silence Removal)
    *   Feature Extraction
    *   Inference (Whisper Small int8)
4.  **Response:** JSON Transcript -> UI Update

---

## 🚀 Quick Start

### 1. Backend Setup
```bash
cd backend
python -m venv venv3.11  # Create Virtual Env
.\venv3.11\Scripts\activate
pip install -r requirements.txt
python main.py           # Starts Server on Port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev              # Starts App on Port 5173
```

### 3. Mobile Testing (Ngrok)
To test on mobile, you need HTTPS. We use Ngrok.
```bash
# In project root
npx -y ngrok http 5173
```
*   Copy the `https://....ngrok-free.dev` URL.
*   Open on iPhone/Android.
*   **Permit Microphone Access.**

---

## ⚙️ Configuration

### `.env` (Backend)
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
API_PORT=8000
```

### `vite.config.ts` (Frontend)
Configured to proxy `/api` and `/ws` to `localhost:8000`. 
Includes `allowedHosts: true` for Ngrok support.

---

## 🧠 Model & Requirements

See [MODELS_REQUIREMENTS.md](./docs/MODELS_REQUIREMENTS.md) for a detailed breakdown of CPU vs GPU selection.

*   **Current Default:** `small` (int8)
*   **RAM Usage:** ~500MB
*   **Target Device:** CPU (Consumer Laptop)

---

## 🐛 Troubleshooting

*   **"System Check Failed":** Ensure Backend is running (`python main.py`).
*   **"Microphone Denied":** Check browser permissions. On iOS, you **MUST** use HTTPS (Ngrok).
*   **"Hallucinations" (Thank you...):** Ensure your environment is quiet. The system acts to filter these, but heavy noise can trigger them.
*   **"Freeze on Close":** Fixed. Clicking 'Cancel' on the system check correctly redirects home.

---

**Version:** 2.1.0
**Last Updated:** Jan 16, 2026
**Developer:** Harshan Aiyappa
