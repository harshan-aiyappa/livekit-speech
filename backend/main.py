import os
import asyncio
import json
import logging
import signal
# Windows compat: SIGKILL doesn't exist, map to SIGTERM
if not hasattr(signal, "SIGKILL"):
    signal.SIGKILL = signal.SIGTERM
import threading
import time
from dotenv import load_dotenv

# LiveKit & Signal Processing  
try:
    from livekit import api, agents, rtc
    from livekit.agents import JobContext, WorkerOptions, cli
    # from livekit.plugins import silero # Unused and causes import error
    LIVEKIT_AVAILABLE = True
except Exception as e:
    print(f"⚠️ LiveKit DLL not available: {e}")
    print("⚠️ Running in WebSocket-ONLY mode (Recommended for single-user apps)")
    LIVEKIT_AVAILABLE = False

import numpy as np

# ASR
from faster_whisper import WhisperModel

# Web Server
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import base64
import shutil
import tempfile
import io
from pydub import AudioSegment
from contextlib import asynccontextmanager

# Load env vars
load_dotenv()

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("asr-worker")
# Silence verbose AI logs
logging.getLogger("faster_whisper").setLevel(logging.WARNING)
# Silence pydub/ffmpeg debug logs
logging.getLogger("pydub.converter").setLevel(logging.WARNING)

# --- Configuration ---
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
API_PORT = int(os.getenv("API_PORT", 8000))

if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
    if LIVEKIT_AVAILABLE:
        logger.warning("⚠️ LiveKit credentials missing, but continuing in WebSocket-only mode")
    # Don't exit - WebSocket mode works without LiveKit

# --- Global State & Lifespan ---
asr_engine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup: Load Model
    global asr_engine
    logger.info("⏳ [LIFESPAN] Loading Whisper model...")
    try:
        asr_engine = MedicalASR()
        logger.info("✅ [LIFESPAN] Whisper model ready.")
    except Exception as e:
        logger.error(f"❌ [LIFESPAN] Model load failed: {e}")

    # 2. Startup: Launch Agent (Single Loop integration)
    agent_task = None
    if LIVEKIT_AVAILABLE and all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
        logger.info("🤖 [LIFESPAN] Starting LiveKit Agent...")
        # We manually construct the Worker to share the same event loop
        # This replaces cli.run_app and avoids threading issues
        worker = agents.Worker(
            WorkerOptions(
                entrypoint_fnc=entrypoint,
                agent_name="MedicalTranscriptionAgent",
                ws_url=LIVEKIT_URL,
                api_key=LIVEKIT_API_KEY,
                api_secret=LIVEKIT_API_SECRET
            )
        )
        agent_task = asyncio.create_task(worker.run())

    yield
    
    # 3. Shutdown
    logger.info("🛑 [LIFESPAN] Shutting down...")
    if agent_task:
        logger.info("🛑 [LIFESPAN] Stopping Agent...")
        # Worker.run() handles its own graceful shutdown signal typically, 
        # but canceling the task aids prompt exit.
        agent_task.cancel()
        try:
            await agent_task
        except asyncio.CancelledError:
            pass
    
# --- FastAPI Setup (Token Server) ---
app = FastAPI(title="LiveKit Voice Agent API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TokenRequest(BaseModel):
    room_name: str
    participant_name: str

@app.post("/api/livekit/token")
async def create_token(req: TokenRequest):
    """
    Generates a LiveKit access token for the frontend client.
    """  
    if not LIVEKIT_AVAILABLE:
        raise HTTPException(status_code=503, detail="LiveKit unavailable - use WebSocket mode")
    
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
        .with_identity(req.participant_name) \
        .with_name(req.participant_name) \
        .with_grants(api.VideoGrants(
            room_join=True,
            room=req.room_name,
            can_publish=True,
            can_subscribe=True
        ))
    
    return {
        "token": token.to_jwt(),
        "livekit_url": LIVEKIT_URL
    }

@app.get("/api/health")
async def health():
    # Robust check: Global engine exists AND model attribute is populated
    is_whisper_ready = asr_engine is not None and getattr(asr_engine, "model", None) is not None
    return {
        "status": "ok", 
        "livekit_available": LIVEKIT_AVAILABLE, 
        "websocket_mode": True,
        "whisper_loaded": is_whisper_ready
    }

class MicStatus(BaseModel):
    status: str
    mode: str
    duration: float = 0.0

@app.post("/api/status/mic")
async def log_mic_status(status: MicStatus):
    """
    Audit log for microphone usage and User Journey Tracking.
    """
    if "joined" in status.mode:
         # Mode Entry Event
         logger.info(f"👤 [USER TRACKING] User ENTERED mode: {status.mode.replace('_joined', '').upper()}")
    elif status.duration > 0:
         # Session Duration Event
         logger.info(f"⏱️ [SESSION STATS] User spent {status.duration:.2f}s in {status.mode.upper()}")
    else:
         # Mic Toggle Event
         logger.info(f"\n==================================================")
         logger.info(f"🎤 [PRIVACY AUDIT] {status.mode.upper()} Microphone is now {status.status.upper()}")
         logger.info(f"==================================================\n")
    return {"status": "logged"}

# Serve React Frontend (Production)
from fastapi.staticfiles import StaticFiles
import os

# Serve React Frontend (Production)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Specific path for assets first (Vite output usually has 'assets' folder)
if os.path.exists("static/assets"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

# SPA Catch-All Route (Must be after API routes)
# This serves index.html for any path not matched by API or assets
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Skip API routes (let them 404 if handled by FastAPI, or they are processed before this)
    if full_path.startswith("api") or full_path.startswith("ws"):
        raise HTTPException(status_code=404, detail="Not Found")
    
    # If file exists in static (e.g. favicon.ico), serve it
    static_file = os.path.join("static", full_path)
    if os.path.exists(static_file) and os.path.isfile(static_file):
        return FileResponse(static_file)
    
    # Otherwise/Default: Serve index.html (React App)
    index_file = os.path.join("static", "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    
    return {"status": "Frontend not found (dev mode)"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time audio transcription.
    Receives base64-encoded audio chunks and returns transcriptions.
    """
    await websocket.accept()
    logger.info("🔌 [MODE: WEBSOCKET-DIRECT] Client connected - Ready for transcription")
    
    # Initialize ASR engine and session buffer
    global asr_engine
    if not asr_engine:
        asr_engine = MedicalASR()
    
    # Buffer to accumulate WebM chunks (must keep the header at the start)
    session_audio_buffer = bytearray()
    last_process_time = time.time()
    processing_task = None # Track async inference status
    
    # Send status to client
    await websocket.send_json({
        "type": "status",
        "whisper_ready": True,
        "mode": "live"
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "audio_chunk":
                try:
                    # process_start = time.time() # Moved inside task
                    audio_base64 = data.get("data", "")
                    audio_bytes = base64.b64decode(audio_base64)
                    
                    # Accumulate bytes
                    session_audio_buffer.extend(audio_bytes)

                    # 🛡️ Truncate Buffer: Keep only last 5s (approx 32KB/s * 5 = 160KB)
                    # Prevents long-running sessions from slowing down pydub parsing
                    if len(session_audio_buffer) > 160 * 1024:
                         session_audio_buffer = session_audio_buffer[-(160 * 1024):]
                    
                    # Non-Blocking Processing Logic
                    # If previous task is still running, SKIP inference for this chunk
                    # This prevents the "60s latency spiral"
                    if processing_task is None or processing_task.done():
                        # Clone buffer for the task
                        buffer_copy =  session_audio_buffer[:] 
                        lang = data.get("language", "en")
                        timestamp = data.get("timestamp", 0)
                        
                        async def task_wrapper(buf, l, ts):
                            loop = asyncio.get_running_loop()
                            t_start = time.time()
                            
                            try:
                                # Prepare WAV in memory
                                audio = AudioSegment.from_file(io.BytesIO(buf), format="webm")
                                # Use last 5s
                                if len(audio) > 5000: audio = audio[-5000:]
                                
                                logger.info(f"[MODE: WEBSOCKET] 🔊 Input Level: {audio.dBFS:.2f} dBFS")
                                if audio.dBFS < -50: return
                                
                                audio = audio.set_channels(1).set_frame_rate(16000)
                                wav_io = io.BytesIO()
                                audio.export(wav_io, format="wav")
                                wav_io.seek(0)
                                
                                # Run Inference
                                def run_transcription():
                                    logger.info(f"[AOI] 🧠 Inference started (Using Loaded Model)")
                                    segments, _ = asr_engine.model.transcribe(
                                        wav_io, beam_size=1, language=l, vad_filter=True,
                                        vad_parameters=dict(min_speech_duration_ms=250),
                                        no_speech_threshold=0.6
                                    )
                                    text = " ".join([s.text for s in segments]).strip()
                                    return asr_engine.filter_hallucinations(text)
                                
                                try:
                                    transcribed_text = await loop.run_in_executor(None, run_transcription)
                                except RuntimeError as e:
                                    if "shutdown" in str(e).lower():
                                        return  # Silently ignore shutdown errors
                                    raise
                                
                                if transcribed_text:
                                    t_end = time.time()
                                    tat = int((t_end - t_start) * 1000)
                                    logger.info(f"[MODE: WEBSOCKET] 📤 Transcript: '{transcribed_text}' ({tat}ms)")
                                    try:
                                        await websocket.send_json({
                                            "type": "transcript",
                                            "text": transcribed_text,
                                            "timestamp": int(time.time() * 1000), # Send Absolute Server Epoch
                                            "isFinal": True,
                                            "turnaround_ms": tat,
                                            "id": f"chunk-{int(time.time()*1000)}"
                                        })
                                    except:
                                        pass # Socket might be closed
                            except RuntimeError as e:
                                if "shutdown" not in str(e).lower():
                                    logger.error(f"Task Error: {e}")
                            except Exception as e:
                                logger.error(f"Task Error: {e}")

                        processing_task = asyncio.create_task(task_wrapper(buffer_copy, lang, timestamp))

                except Exception as e:
                    logger.error(f"❌ Error processing audio chunk: {e}")
    
    except WebSocketDisconnect:
        logger.info("👋 WebSocket client disconnected")
    except Exception as e:
        logger.error(f"💥 WebSocket error: {e}")
        await websocket.close()


# --- ASR Worker Logic ---

class MedicalASR:
    """
    Manages the faster-whisper model and VAD for transcription
    """
    def __init__(self):
        # Allow configuration via Env (e.g. 'medium' for Server, 'tiny' for fast CPU)
        model_size = os.getenv("MODEL_SIZE", "small")
        device = os.getenv("WHISPER_DEVICE", "cpu")
        compute_type = os.getenv("WHISPER_COMPUTE", "int8")

        logger.info(f"⏳ Loading Whisper ({model_size}) model on {device}...")
        try:
            self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        except Exception as e:
            logger.warning(f"⚠️ Failed to load '{model_size}' model: {e}")
            logger.warning("⚠️ Falling back to 'base' (CPU/int8)")
            self.model = WhisperModel("base", device="cpu", compute_type="int8")
             
        logger.info(f"✅ Whisper model loaded.")
        
        # Hallucination Blocklist (Common subtitle artifacts)
        self.HALLUCINATIONS = {
            "Thank you.", "Thanks for watching.", "You", 
            "MBC", "Amara.org", "Subtitles by", "Subtitles",
            "Copyright", "©"
        }
    
    def filter_hallucinations(self, text: str) -> str:
        if not text: return ""
        if text.strip() in self.HALLUCINATIONS:
            return ""
        # If text starts with "Thank you" and is very short, ignore
        if text.strip().startswith("Thank you") and len(text) < 15:
            return ""
        return text
        
    async def transcribe_buffer(self, audio_data: np.ndarray, sample_rate: int):
        """
        Transcribes raw float32 audio data.
        """
        # Convert to text using faster-whisper
        # faster-whisper expects float32 array
        segments, _ = self.model.transcribe(
            audio_data, 
            beam_size=1, 
            language="en",
            vad_filter=True
        )
        
        full_text = " ".join([s.text for s in segments]).strip()
        return full_text

# Global ASR instance initialized on startup
asr_engine = MedicalASR()

async def entrypoint(ctx: 'JobContext'):
    """
    Main LiveKit Agent Entrypoint.
    """
    try:
        # Give the event loop a breath to prevent AssignmentTimeoutError on busy Windows threads
        await asyncio.sleep(0.1)
        
        logger.info(f"[AGENT MODE] 🚀 Agent assigned to room: {ctx.room.name}")
        await ctx.connect()
    except Exception as e:
        logger.error(f"[AGENT MODE] 💥 Connection/Assignment failed: {e}")
        return
    logger.info(f"[AGENT MODE] ✅ Connected. Participants: {len(ctx.room.remote_participants)}")
    
    # Store settings per participant (e.g. language)
    participant_configs = {}

    def handle_track(track, participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"[AGENT MODE] 🎤 Processing audio track {track.sid} from {participant.identity}")
            asyncio.create_task(process_audio_track(ctx, track, participant, participant_configs))

    @ctx.room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        if data.topic == "config":
            try:
                msg = json.loads(data.data)
                if msg.get("type") == "config":
                    identity = data.participant.identity
                    lang = msg.get("language", "en")
                    participant_configs[identity] = {"language": lang}
                    logger.info(f"[AGENT MODE] ⚙️ Language set to '{lang}' for {identity}")
            except Exception as e:
                if "shutdown" in str(e).lower():
                     pass # Agent is stopping, ignore
                else:
                    logger.error(f"[AGENT MODE] Error processing config: {e}")

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        handle_track(track, participant)

    @ctx.room.on("track_published")
    def on_track_published(publication, participant):
        if publication.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"[AGENT MODE] 📡 New track published: {publication.sid}. Subscribing...")
            publication.set_subscribed(True)

    # Scavenge for existing tracks (in case user joined before agent)
    for participant in ctx.room.remote_participants.values():
        for publication in participant.track_publications.values():
            if publication.kind == rtc.TrackKind.KIND_AUDIO:
                if publication.track:
                    handle_track(publication.track, participant)
                else:
                    logger.info(f"[AGENT MODE] 🔍 Auto-subscribing to existing track {publication.sid}")
                    publication.set_subscribed(True)

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        logger.info(f"[AGENT MODE] 👤 Participant joined: {participant.identity}")

    # Wait for the job to close
    # ctx.wait_for_shutdown() is handled by the worker framework usually, 
    # but we can keep the coroutine alive if needed.

async def process_audio_track(ctx: 'JobContext', track, participant, participant_configs):
    """
    Reads audio frames from the track, buffers them, and runs ASR.
    """
    # Create an audio stream (yielding AudioFrames)
    # Force 16kHz for Whisper compatibility
    audio_stream = rtc.AudioStream(track, sample_rate=16000)
    
    # We will accumulate audio data (PCM 16kHz mono)
    audio_buffer = bytearray()
    
    # Configuration
    SAMPLE_RATE = 16000
    BYTES_PER_SAMPLE = 2 # int16
    BUFFER_SECONDS = 0.6 # Reduced from 1.0s to 0.6s for near-realtime TAT
    BUFFER_SIZE_BYTES = int(SAMPLE_RATE * BYTES_PER_SAMPLE * BUFFER_SECONDS)
    
    logger.info(f"[MODE: LIVEKIT-AGENT] 🎧 Started processing audio for {participant.identity}")
    
    # helper for non-blocking processing
    async def process_step(audio_data, lang_code):
        check_peak = np.abs(audio_data).max()
        # Debugging: Log every analysis attempt to trace "missing" audio
        logger.info(f"[AGENT] 🔍 Analysing audio chunk (Peak: {check_peak:.4f})")
        
        if check_peak < 0.005: return 

        process_start = time.time()
        loop = asyncio.get_running_loop()
        
        def do_transcribe(data, lang):
            segments, _ = asr_engine.model.transcribe(
                 data, beam_size=1, language=lang, 
                 # Disable VAD to prevent hanging on silence
                 vad_filter=False
            )
            text = " ".join([seg.text for seg in segments]).strip()
            return asr_engine.filter_hallucinations(text)

        try:
            # SAFETY: Timeout after 2.0s to prevent blocking future audio
            full_transcription = await asyncio.wait_for(
                loop.run_in_executor(None, do_transcribe, audio_data, lang_code), 
                timeout=2.0
            )
            if full_transcription:
                turnaround_ms = int((time.time() - process_start) * 1000)
                payload = json.dumps({
                    "type": "transcript",
                    "text": full_transcription,
                    "isFinal": True,
                    "participantId": participant.identity,
                    "timestamp": int(time.time() * 1000),
                    "turnaround_ms": turnaround_ms
                })
                await ctx.room.local_participant.publish_data(payload, topic="transcription", reliable=True)
                
                logger.info(f"[AGENT MODE] 📤 Sent to UI: '{full_transcription}'")
        except Exception as e:
            logger.error(f"[AGENT MODE] Task failed: {e}")

    # Main Loop
    processing_task = None
    frame_count = 0
    try:
        async for event in audio_stream:
            await asyncio.sleep(0)
            audio_buffer.extend(event.frame.data.tobytes())
            
            frame_count += 1
            if frame_count % 500 == 0:
                 logger.info(f"[AGENT] Stream active...")

            # Dynamic Batching
            if len(audio_buffer) >= BUFFER_SIZE_BYTES:
                # If busy, keep buffering (don't overwrite/skip, just accumulate context!)
                if processing_task and not processing_task.done():
                    continue 
                
                # Ready to process
                audio_np = np.frombuffer(audio_buffer, dtype=np.int16).astype(np.float32) / 32768.0
                audio_buffer.clear()
                
                # Launch background task
                current_lang = participant_configs.get(participant.identity, {}).get("language", "en")
                processing_task = asyncio.create_task(process_step(audio_np, current_lang))


    except asyncio.CancelledError:
        logger.info(f"[AGENT MODE] 🛑 Audio processing task cancelled for {participant.identity}")
        return # Exit cleanly


# --- Main Application Runner ---

if __name__ == "__main__":
    print(f"🚀 Starting Unified Server (API + Agent on Port {API_PORT})...")
    # Single Process, Single Loop, Maximum Stability
    uvicorn.run(app, host="0.0.0.0", port=API_PORT)
