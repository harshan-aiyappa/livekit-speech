# Vocalis - Real-time Medical ASR System Documentation

## 1. Project Overview
**Vocalis** is a high-performance, real-time Speech-to-Text (STT) application optimized for medical dictation. It allows users to transcribe speech instantly using advanced AI models (Faster-Whisper), with a focus on privacy, low latency, and robust error handling. The system supports three distinct operational modes to accommodate various network environments and architectural preferences.

---

## 2. Technology Stack & Key Packages

### 🎨 Frontend (User Interface)
| Category           | Package/Tool            | Purpose                                                 |
| :----------------- | :---------------------- | :------------------------------------------------------ |
| **Core Framework** | `React 18`              | Component-based UI library.                             |
| **Build Tool**     | `Vite`                  | Instant dev server & optimized bundler (ESBuild based). |
| **Language**       | `TypeScript 5.6`        | Static typing for enterprise-grade contract safety.     |
| **Routing**        | `wouter`                | Tiny (1.5KB) router for zero-bloat navigation.          |
| **State/Query**    | `@tanstack/react-query` | Server-state management (Health checks, API polling).   |
| **Real-time**      | `livekit-client`        | WebRTC connection management (Room, Tracks, Events).    |
| **Styling**        | `Tailwind CSS 3.4`      | Utility-first styling engine.                           |
| **UI Library**     | `ShadCN UI`             | Headless, accessible components built on `@radix-ui`.   |
| **Animations**     | `Framer Motion`         | Complex exit/entry transitions and layout shifts.       |
| **Visuals**        | `tsparticles`           | Dynamic particle background effects (Vanta-style).      |
| **Icons**          | `Lucide React`          | Consistent, lightweight SVG iconography.                |

### ⚙️ Backend (Inference Engine)
| Category        | Package/Tool       | Purpose                                                                      |
| :-------------- | :----------------- | :--------------------------------------------------------------------------- |
| **Server**      | `FastAPI`          | High-performance async Python web framework (Starlette based).               |
| **ASGI Server** | `Uvicorn`          | Lightning-fast ASGI server implementation.                                   |
| **AI Model**    | `faster-whisper`   | CTranslate2-optimized implementation of Whisper (5x faster than OpenAI ref). |
| **Math**        | `NumPy`            | High-speed array manipulation for audio buffers (float32 conversion).        |
| **Audio Tools** | `PyDub` / `FFmpeg` | Audio format conversion (WebM -> WAV) and dBFS calculation.                  |
| **WebRTC**      | `livekit-agents`   | Python SDK for joining Rooms as a hidden Agent participant.                  |
| **Reloading**   | `watchfiles`       | File watcher for auto-restarting backend on code changes.                    |
| **Env Mgmt**    | `python-dotenv`    | Loading configuration from `.env` files safely.                              |

---

## 3. System Architecture & Flows

The application is designed effectively as a **Hybrid Monolith**: a single backend service handles both API requests and real-time streams, while a decoupled React frontend consumes it.

### A. Agent Mode (Pure WebRTC)
*Objective: Lowest possible latency using modern WebRTC data channels.*
1.  **Connection:** Frontend connects to LiveKit Cloud Room. Backend Agent joins as a hidden participant.
2.  **Audio Flow:** User audio is sent via WebRTC Audio Track.
3.  **Processing:** 
    - Backend Agent subscribes to the track.
    - Captures audio frames via `rtc.AudioStream`.
    - buffers frames (1.0s window).
    - Runs VAD check -> If speech detected -> Runs Whisper Inference.
4.  **Feedback:** Transcription is sent back via **WebRTC Data Packet** (reliable channel).
5.  **Advantages:** Extremely resilient to packet loss, sub-500ms latency possible.

### B. Hybrid Mode (Room + WebSocket)
*Objective: Leveraging LiveKit for presence/video while using custom transport for audio data.*
1.  **Connection:** Frontend joins LiveKit Room (for status/presence) AND opens a direct WebSocket to Backend.
2.  **Audio Flow:** 
    - Frontend captures Mic.
    - `MediaRecorder` API creates Opus/WebM encoded chunks.
    - Chunks are sent via **WebSocket**.
3.  **Processing:** Backend decodes WebM -> WAV -> Whisper Inference.
4.  **Feedback:** Transcript sent via WebSocket.
5.  **Advantages:** Decoupled audio logic; allows custom audio encoding control.

### C. Direct Mode (WebSocket Only)
*Objective: Zero-dependency, lightweight streaming.*
1.  **Connection:** Direct WebSocket connection to `/ws`. No LiveKit required.
2.  **Audio Flow:** P2P streaming of Opus chunks from Client to Server.
3.  **Advantages:** Simple, works offline (if backend is local), no external vendor dependency.

---

## 4. Behind the Scenes: The "Microphone-to-Text" Signal Flow

This section details exactly what happens "under the hood" when a user speaks, millisecond by millisecond.

### ⏱️ Phase 1: The Client (Frontend)
1.  **0ms - User Interaction:** The user clicks the **Microphone** icon.
2.  **Hardware Acquisition:**
    *   The Browser invokes `navigator.mediaDevices.getUserMedia({ audio: true })`.
    *   **Privacy Check:** The browser prompts for permission (if not already granted).
    *   **Standby Activation:** The mic stream is actually *already active* (created on component mount) but routed only to the local `AudioContext` for the visualizer.
3.  **Data Capture:**
    *   **Agent Mode:** The predefined `LocalAudioTrack` is explicitly **Published** to the LiveKit Room.
    *   **Hybrid/Direct Mode:** A `MediaRecorder` instance starts slicing audio into **500ms** to **1000ms** chunks (Opus encoded).
4.  **Transmission:**
    *   *WebRTC (Agent):* Audio is streamed via UDP (RTP packets) directly to LiveKit's SFU (Selective Forwarding Unit), which forwards it to the Python Backend.
    *   *WebSocket (Hybrid/Direct):* The `blob` data is converted to Base64 and wrapped in a JSON packet: `{ type: "audio_chunk", data: "...", timestamp: 12345 }` and sent over TCP.

### ⚙️ Phase 2: The Server (Backend)
5.  **Ingestion:**
    *   The Python `main.py` loop receives the discrete packets.
    *   **Buffering:** Packets are appended to a `session_audio_buffer` (bytearray). We maintain a rolling window of the last 1-10 seconds of audio.
6.  **Pre-Processing:**
    *   The buffer is converted to a NumPy array (`float32`).
    *   **Volume Gate:** We check `np.abs(audio).max()`. If the peak volume is `< 0.04` (4%), we discard the chunk immediately as "Silence" to save CPU.
    *   **Conversion:** The raw bytes are decoded (from WebM/Opus) into PCM WAV format (16kHz, Mono) using `ffmpeg` / `pydub`.
7.  **AI Inference (The "Brain"):**
    *   The audio data is passed to `faster_whisper` running in a separate thread (Executor).
    *   **VAD (Voice Activity Detection):** Silero VAD analyzes the clip. If valid speech is found, the Transformer model runs.
    *   **Transcription:** The model generates tokens -> text. Hallucination filters remove artifacts like "Thank you for watching."

### 📡 Phase 3: The Response
8.  **Packaging:**
    *   The result text is wrapped in a JSON response:
        ```json
        {
          "type": "transcript",
          "text": "Hello world",
          "timestamp": 1705643000123,
          "isFinal": true,
          "turnaround_ms": 245
        }
        ```
9.  **Delivery:**
    *   The JSON is sent back via the established **Data Channel** (Agent) or **WebSocket** (Hybrid/Direct).
10. **Rendering (Frontend):**
    *   React receives the event.
    *   `sessionStartRef` is used to calculate the relative "offset" for the transcript.
    *   The text is injected into the `segments` state array.
    *   **UI Update:** The virtual DOM updates, and the text appears on screen. Total elapsed time: **~300-600ms**.

---

## 5. Key Implementation Details

### 🔒 Privacy & Microphone Handling ("Standby Mode")
To ensure user privacy without sacrificing UI responsiveness, we implemented a strict "Standby" pattern:
- **Initialization:** The microphone track is created immediately on load to "warm up" the hardware.
- **Standby State:** The track is kept **unpublished** (Agent) or the `MediaRecorder` is **paused** (Hybrid/Direct).
- **Validation:** 
    - The local `AudioContext` *still receives input* locally to drive the **Audio Visualizer**, giving the user confidence the mic is working.
    - **NO DATA** leaves the client until the "Record" button is pressed.
- **Audit Logging:** Every Start/Stop action triggers a call to `/api/status/mic`, generating a `[PRIVACY AUDIT]` log entry in the backend console for compliance.

### 🛑 Graceful Shutdowns
- The backend handles `asyncio.CancelledError` within the infinite audio processing loops.
- `await asyncio.sleep(0)` commands are injected to allow the Event Loop to pause and process cancellation signals, preventing "Task took too long" warnings during component unmounts.

---

## 6. ⏱️ Performance & Latency Deep Dive (TAT)

Turnaround Time (TAT) is the critical metric: *Time from "Word Spoken" to "Text on Screen".*

### A. Agent Mode (Fastest: ~300-500ms)
- **Transport:** UDP (WebRTC). Packets are sent individually (20ms frames). No "chunking" delay.
- **Server:** LiveKit SFU forwards RTP packets instantly.
- **Inference:** VAD triggers immediately on speech end.
- **Why it's fast:** No TCP Handshake overhead, no waiting for a 1-second file chunk to fill up.

### B. Hybrid / WebSocket Mode (~600-1000ms)
- **Transport:** TCP (WebSocket). Requires reliable delivery (slower than UDP).
- **Buffering:** Client MUST record at least **500ms - 1000ms** of audio to create a valid encoded Opus header.
- **Penalty:** This "Chunking Delay" is inherent. If you speak a 200ms word, we still wait for the 500ms chunk to finish filling before sending.

### 📉 Optimization Techniques Used
1.  **Volume Gating:** We drop silence chunks (`< 1%` volume) *before* they hit the AI model, saving ~200ms of useless inference time.
2.  **Int8 Quantization:** Running `faster-whisper` in 8-bit mode speeds up CPU inference by 2x compared to FP32.
3.  **Keep-Alive:** The WebSocket connection is established *before* recording starts, eliminating the 100ms Handshake delay on the first phrase.

---

## 7. 🧠 AI Model & Audio Processing

### The Engine: Faster-Whisper
We use `faster-whisper`, a C++ optimized implementation of OpenAI's Whisper model (using `CTranslate2`).
- **Model:** `small` (Balance of speed vs accuracy. Better than `base`, faster than `medium`).
- **Device:** CPU Mode (Universal compatibility).
- **Quantization:** `int8` (High performance on non-GPU instances).

### Signal Processing Chain
1.  **Volume Gate (1% Threshold):**
    - Code: `if peak < 0.01: continue`
    - Purpose: Filters out air conditioner hum, keyboard clicks, and breath sounds.
2.  **VAD (Voice Activity Detection):**
    - Tool: **Silero VAD**.
    - Purpose: Tells the AI "This is speech" vs "This is a dog barking".
    - Settings: `min_speech_duration_ms=250` (Prevents transcribing short noises).
3.  **Hallucination Filter:**
    - The AI sometimes outputs "Thank you for watching" during silence. We filter these known artifacts out via a blocklist.

---

## 8. 🎨 UX Micro-Interactions (The "Delight" Layer)

Small details make the app feel "Pro".

### A. The "Alive" Visualizer
- **Visual:** A 40-bar frequency analyzer.
- **Behavior:** It is **ALWAYS** active when connected (Standby Mode).
- **Why?** It solves the "Is my mic on?" anxiety before the user even hits Record.
- **Tech:** Uses `requestAnimationFrame` (60fps) and `AnalyserNode.getByteFrequencyData` for butter-smooth movement.

### B. Status Badges & Toasts
- **Active State:** When recording, a pulsing "Transcription Active" badge appears.
- **Feedback:** "Session Active" and "Session Ended" toasts provide clear confirmation of system state changes.
- **Health Check:** On load, the system probes `/api/health` to confirm the AI engine is loaded before enabling the UI.

---

## 9. 🔮 Enhancements & Roadmap
- **Speaker Diarization:** Identify "Doctor" vs "Patient" automatically.
- **Medical Vocabulary:** Fine-tune Whisper on medical datasets (PubMed).
- **GPU Acceleration:** Add CUDA support for 10x faster inference on capable hardware.
- **Mobile App:** React Native port for iOS/Android.

---

## 10. How to Run

### prerequisites
- Node.js 18+
- Python 3.11+
- LiveKit Cloud Account (for Agent/Hybrid modes)

### Steps
1.  **Start Backend:**
    ```bash
    cd backend
    .\venv3.11\Scripts\Activate.ps1
    python main.py
    ```
2.  **Start Frontend:**
    ```bash
    cd frontend
    npm run dev
    ```
3.  **Access:** Open `http://localhost:5173`.
4.  **(Optional) Mobile Access:**
    ```bash
    npx ngrok http 5173
    ```
