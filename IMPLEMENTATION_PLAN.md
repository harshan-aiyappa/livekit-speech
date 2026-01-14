# ✅ Implementation Plan: aligning `livekit-speech` with Authoritative Flow

## 🔴 Current Status vs. Authoritative Design

| Component           | Authoritative Design                           | Current Implementation                    | Status         |
| :------------------ | :--------------------------------------------- | :---------------------------------------- | :------------- |
| **Audio Transport** | Client Mic -> LiveKit (WebRTC) -> Backend      | Client Mic -> WebSocket -> Backend        | ❌ **MISMATCH** |
| **Backend Role**    | LiveKit Worker (Subscribes to Track)           | HTTP/WebSocket Server                     | ❌ **MISMATCH** |
| **frontend**        | Publish Mic Track, Receive DataChannel         | Publish Mic + Stream MediaRecorder via WS | ❌ **MISMATCH** |
| **Processing**      | Noise Calc -> Gate -> VAD -> Buffer -> Whisper | Direct Whisper on incoming bytes          | ❌ **MISMATCH** |
| **Output**          | LiveKit DataChannel                            | WebSocket Message                         | ❌ **MISMATCH** |

---

## 🛠️ Refactoring Roadmap

### Phase 1: Backend Transformation (The Worker)
**Goal:** Convert `backend/main.py` from a passive API server to an active LiveKit Worker.

1.  **Install Dependencies**: `livekit-server-sdk` (already present? check), `webrtcvad`, `numpy`.
2.  **Create Worker Class**:
    *   Connect to LiveKit URL using API Key/Secret.
    *   Listen for `TrackSubscribed` events.
    *   Create `AudioStream` from the remote track.
3.  **Implement Audio Pipeline**:
    *   **Ingest**: Read frames from `AudioStream` (pcm_16k_mono).
    *   **Noise Calibration**: First 1s analysis (RMS/Energy).
    *   **Noise Gate**: Drop frames below threshold.
    *   **VAD**: Use `webrtcvad` to filter silence.
    *   **Buffer**: Accumulate speech frames into 2.5s-3s chunks.
4.  **Integrate Whisper**:
    *   Pass buffered audio (bytes) to `faster-whisper`.
5.  **Response Mechanism**:
    *   Use `room.local_participant.publish_data()` to send transcripts back.

### Phase 2: Frontend Cleanup
**Goal:** Remove "Double Streaming" and rely solely on LiveKit.

1.  **Remove WebSocket**: Delete `wsRef`, `mediaRecorderRef` logic from `useLiveKit.ts`.
2.  **Remove WS Event Listeners**: Delete `onmessage` handling for transcripts.
3.  **Implement Data Channel**:
    *   Add listener for `RoomEvent.DataReceived`.
    *   Decode payload -> Update `segments` state.

---

## 📋 Execution Steps

1.  **Backend**: Update `requirements.txt` / install `webrtcvad` `numpy`.
2.  **Backend**: Rewrite `backend/main.py` to run the Worker loop alongside (or instead of) the API server.
    *   *Note*: We still need the API server for Token Generation (`/api/livekit/token`).
    *   The Worker can run as a background task or separate process. For simplicity in `dev`, we can launch it within `startup_event` of FastAPI, or just have it run continuously.
3.  **Frontend**: Modify `useLiveKit.ts`.

## ✅ Resulting Architecture
*   **User** speaks -> **LiveKit** relays Audio -> **Python Worker** receives AudioStream -> **Pipeline** (VAD/Whisper) -> **Text** -> **LiveKit** relays Data -> **Frontend** displays.
