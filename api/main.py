import os
import time
import asyncio
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/api/health")
async def health_check_with_prefix():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/livekit/token")
async def generate_token():
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        return {"error": "LiveKit not configured"}, 500
    
    room_name = f"transcription-{int(time.time() * 1000)}"
    identity = f"user-{int(time.time() * 1000)}"
    
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

SAMPLE_PHRASES = [
    "Hello, this is a test of the voice transcription system.",
    "The quick brown fox jumps over the lazy dog.",
    "Real-time speech recognition is an exciting technology.",
    "LiveKit provides excellent WebRTC infrastructure for audio streaming.",
    "This is a demonstration of the transcription capabilities.",
    "FastAPI powers our Python backend for token generation.",
    "The frontend connects via WebSocket for real-time updates.",
]


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("WebSocket client connected")
    
    segment_counter = 0
    session_start = time.time()
    simulation_task: Optional[asyncio.Task] = None
    
    try:
        async def send_simulated_transcripts():
            nonlocal segment_counter
            while True:
                await asyncio.sleep(3)
                segment_counter += 1
                phrase = SAMPLE_PHRASES[segment_counter % len(SAMPLE_PHRASES)]
                
                transcript_data = {
                    "type": "transcript",
                    "id": f"segment-{segment_counter}",
                    "timestamp": int((time.time() - session_start) * 1000),
                    "text": phrase,
                    "confidence": 0.85 + (segment_counter % 15) / 100,
                    "speaker": "Speaker 1",
                    "isFinal": True,
                }
                
                await manager.send_transcript(websocket, transcript_data)
        
        simulation_task = asyncio.create_task(send_simulated_transcripts())
        
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                print(f"Received message: {message}")
                
                if message.get("type") == "audio":
                    segment_counter += 1
                    await manager.send_transcript(websocket, {
                        "type": "transcript",
                        "id": f"segment-{segment_counter}",
                        "timestamp": int((time.time() - session_start) * 1000),
                        "text": "Processing audio...",
                        "isFinal": False,
                    })
            except json.JSONDecodeError:
                print("Failed to parse WebSocket message")
                
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if simulation_task:
            simulation_task.cancel()
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
