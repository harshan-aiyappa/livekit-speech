import os
import time
import asyncio
import json
import io
import base64
import tempfile
from datetime import datetime, timedelta
from typing import Optional
import threading

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from livekit import api
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Voice Transcription API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL")

whisper_model = None
whisper_lock = threading.Lock()

def load_whisper_model():
    global whisper_model
    try:
        from faster_whisper import WhisperModel
        print("Loading faster-whisper model (tiny)...")
        whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")
        print("Whisper model loaded successfully!")
        return True
    except Exception as e:
        print(f"Failed to load Whisper model: {e}")
        return False

@app.on_event("startup")
async def startup_event():
    threading.Thread(target=load_whisper_model, daemon=True).start()

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "whisper_loaded": whisper_model is not None
    }

@app.get("/api/health")
async def health_check_with_prefix():
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "whisper_loaded": whisper_model is not None
    }

from pydantic import BaseModel

class TokenRequest(BaseModel):
    roomName: Optional[str] = None
    identity: Optional[str] = None

@app.post("/livekit/token")
async def generate_token(request: TokenRequest = None):
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        return {"error": "LiveKit not configured"}, 500
    
    # Use provided values or defaults
    room_name = request.roomName if request and request.roomName else f"transcription-{int(time.time() * 1000)}"
    identity = request.identity if request and request.identity else f"user-{int(time.time() * 1000)}"
    
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
        .with_identity(identity) \
        .with_name(identity) \
        .with_ttl(timedelta(hours=1)) \
        .with_grants(api.VideoGrants(
            room=room_name,
            room_join=True,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        ))
    
    jwt_token = token.to_jwt()
    
    print(f"Generated token for room: {room_name}, identity: {identity}")
    
    return {
        "token": jwt_token,
        "roomName": room_name,
        "identity": identity,
        "livekitUrl": LIVEKIT_URL or "wss://kimo-zg71lj4i.livekit.cloud"
    }


def transcribe_audio(audio_data: bytes) -> dict:
    global whisper_model
    if whisper_model is None:
        return {"text": "", "error": "Whisper model not loaded"}
    
    try:
        # Use delete=False because on Windows we can't open the file again while it's open
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
            tmp_file.write(audio_data)
            tmp_file.flush()
            tmp_filename = tmp_file.name
            
        try:
            with whisper_lock:
                segments, info = whisper_model.transcribe(
                    tmp_filename,
                    beam_size=1,
                    language="en",
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500)
                )
                
                text_segments = []
                for segment in segments:
                    text_segments.append({
                        "start": segment.start,
                        "end": segment.end,
                        "text": segment.text.strip(),
                    })
                
                full_text = " ".join([s["text"] for s in text_segments])
                
                return {
                    "text": full_text,
                    "segments": text_segments,
                    "language": info.language,
                    "language_probability": info.language_probability
                }
        finally:
            # Clean up the temp file
            if os.path.exists(tmp_filename):
                try:
                    os.remove(tmp_filename)
                except Exception as e:
                    print(f"Failed to delete temp file: {e}")

    except Exception as e:
        print(f"Transcription error: {e}")
        return {"text": "", "error": str(e)}


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_transcript(self, websocket: WebSocket, data: dict):
        await websocket.send_json(data)


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("WebSocket client connected")
    
    segment_counter = 0
    session_start = time.time()
    
    await manager.send_transcript(websocket, {
        "type": "status",
        "whisper_ready": whisper_model is not None,
        "mode": "live"
    })
    
    try:
        while True:
            data = await websocket.receive()
            
            if "bytes" in data:
                audio_bytes = data["bytes"]
                segment_counter += 1
                print(f"Received audio chunk: {len(audio_bytes)} bytes")
                
                await manager.send_transcript(websocket, {
                    "type": "transcript",
                    "id": f"segment-{segment_counter}",
                    "timestamp": int((time.time() - session_start) * 1000),
                    "text": "Transcribing...",
                    "isFinal": False,
                })
                
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, transcribe_audio, audio_bytes)
                
                if result.get("text"):
                    await manager.send_transcript(websocket, {
                        "type": "transcript",
                        "id": f"segment-{segment_counter}",
                        "timestamp": int((time.time() - session_start) * 1000),
                        "text": result["text"],
                        "confidence": result.get("language_probability", 0.9),
                        "speaker": "Speaker 1",
                        "isFinal": True,
                        "mode": "live"
                    })
                elif result.get("error"):
                    print(f"Transcription failed: {result['error']}")
            
            elif "text" in data:
                try:
                    message = json.loads(data["text"])
                    print(f"Received message: {message}")
                    
                    if message.get("type") == "audio_chunk" and "data" in message:
                        audio_data = base64.b64decode(message["data"])
                        segment_counter += 1
                        print(f"Received base64 audio: {len(audio_data)} bytes")
                        
                        loop = asyncio.get_event_loop()
                        result = await loop.run_in_executor(None, transcribe_audio, audio_data)
                        
                        if result.get("text"):
                            await manager.send_transcript(websocket, {
                                "type": "transcript",
                                "id": f"segment-{segment_counter}",
                                "timestamp": int((time.time() - session_start) * 1000),
                                "text": result["text"],
                                "confidence": result.get("language_probability", 0.9),
                                "speaker": "Speaker 1",
                                "isFinal": True,
                                "mode": "live"
                            })
                    
                    elif message.get("type") == "ping":
                        await manager.send_transcript(websocket, {"type": "pong"})
                        
                except json.JSONDecodeError:
                    print("Failed to parse WebSocket message")
                    
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)


@app.post("/transcribe")
async def transcribe_file(file: UploadFile = File(...)):
    if whisper_model is None:
        return {"error": "Whisper model not loaded yet, please wait..."}
    
    audio_data = await file.read()
    result = transcribe_audio(audio_data)
    return result


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
