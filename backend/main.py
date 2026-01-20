import os
import asyncio
import json
import logging
import signal
import threading
import time
import io
import base64
import numpy as np
import shutil
import tempfile
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Web Server & Utilities
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
from pydub import AudioSegment

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

# ASR
from faster_whisper import WhisperModel

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
asr_executor = threading.Thread(target=lambda: None) # Placeholder
from concurrent.futures import ThreadPoolExecutor
# Dedicated pool for CPU-bound inference
inference_executor = ThreadPoolExecutor(max_workers=1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Startup: Verify FFmpeg
    if not shutil.which("ffmpeg"):
        logger.error("❌ FFmpeg not found in PATH. Audio processing will fail.")
        # We don't exit, but we warn heavily
    else:
        logger.info("✅ FFmpeg verified in system PATH.")

    # 2. Startup: Load Model
    global asr_engine
    if asr_engine is None:
        logger.info("[LIFESPAN] Loading Whisper model...")
        try:
            asr_engine = MedicalASR()
            logger.info("[LIFESPAN] Whisper model ready.")
        except Exception as e:
            logger.error(f"[LIFESPAN] Model load failed: {e}")

    # 2. Startup: Launch Agent Background Task Handler
    # We no longer use agents.Worker(run) because custom LiveKit instances
    # often lack the Job Manager. We join rooms directly.
    logger.info("[LIFESPAN] Ready to spawn agents on-demand.")

    yield
    
    # 3. Shutdown
    logger.info("[LIFESPAN] Shutting down...")
    
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
    
    # --- TRIGGER AGENT (Manual Spawn) ---
    if req.room_name.startswith("agent-"):
        logger.info(f"Triggering Agent for room: {req.room_name}")
        asyncio.create_task(spawn_agent(req.room_name))

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
    header_buffer = bytearray()
    session_audio_buffer = bytearray()
    processing_task = None 
    
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
                    audio_base64 = data.get("data", "")
                    audio_bytes = base64.b64decode(audio_base64)
                    
                    # Capture header on first chunk
                    if not header_buffer:
                        header_buffer = audio_bytes[:4096] # Capture first 4KB (WebM Header)
                    
                    # 🔄 Accumulate bytes (Full stream to ensure valid decoding)
                    session_audio_buffer.extend(audio_bytes)
                    
                    if processing_task is None or processing_task.done():
                        # Construct a valid WebM snippet by prepending EVERYTHING since start
                        # WebM decoding of partial streams is fragile; full stream is safer.
                        buffer_copy = bytes(session_audio_buffer)
                        lang = data.get("language", language_ref.current if 'language_ref' in locals() else "en")
                        
                        async def task_wrapper(buf, l):
                            loop = asyncio.get_running_loop()
                            t_start = time.time()
                            
                            try:
                                # Prepare WAV in memory
                                audio = AudioSegment.from_file(io.BytesIO(buf), format="webm")
                                
                                # 🛡️ LIMIT TO LAST 5s FOR SPEED
                                if len(audio) > 5000: audio = audio[-5000:]
                                
                                logger.info(f"[MODE: WEBSOCKET] 🔊 Input Level: {audio.dBFS:.2f} dBFS")
                                if audio.dBFS < -65: return # More sensitive (-50 -> -65)
                                
                                audio = audio.set_channels(1).set_frame_rate(16000)
                                wav_io = io.BytesIO()
                                audio.export(wav_io, format="wav")
                                wav_io.seek(0)
                                
                                # Run Inference with Timeout and dedicated pool
                                def run_transcription():
                                    logger.info(f"[AOI] 🧠 Inference started for WebSocket...")
                                    segments, _ = asr_engine.model.transcribe(
                                        wav_io, beam_size=1, language=l, vad_filter=True,
                                        vad_parameters=dict(min_speech_duration_ms=150), # High responsiveness
                                        no_speech_threshold=0.6
                                    )
                                    raw_text = " ".join([s.text for s in segments]).strip()
                                    if raw_text:
                                        logger.info(f"[MODE: WEBSOCKET] 👂 Whisper heard: '{raw_text}'")
                                    return asr_engine.filter_hallucinations(raw_text)
                                
                                try:
                                    # Removed timeout as requested - let it run until finished
                                    # transcribed_text = await asyncio.wait_for(
                                    #     loop.run_in_executor(inference_executor, run_transcription),
                                    #     timeout=15.0
                                    # )
                                    transcribed_text = await loop.run_in_executor(inference_executor, run_transcription)
                                except Exception as e:
                                    logger.error(f"[MODE: WEBSOCKET] ❌ Inference failed: {e}")
                                    return

                                if transcribed_text:
                                    t_end = time.time()
                                    tat = int((t_end - t_start) * 1000)
                                    logger.info(f"[MODE: WEBSOCKET] 📤 Final Transcript: '{transcribed_text}' ({tat}ms)")
                                    try:
                                        await websocket.send_json({
                                            "type": "transcript",
                                            "text": transcribed_text,
                                            "timestamp": int(time.time() * 1000), 
                                            "isFinal": True,
                                            "turnaround_ms": tat,
                                            "id": f"chunk-{int(time.time()*1000)}"
                                        })
                                    except:
                                        pass
                                else:
                                    if transcribed_text == "":
                                         logger.info("[MODE: WEBSOCKET] 🔕 Filtered/Empty result (No speech detected)")
                            except RuntimeError as e:
                                if "shutdown" not in str(e).lower():
                                    logger.error(f"Task Error: {e}")
                            except Exception as e:
                                logger.error(f"Task Error: {e}")

                        processing_task = asyncio.create_task(task_wrapper(buffer_copy, lang))

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

        logger.info(f"Loading Whisper ({model_size}) model on {device}...")
        try:
            self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        except Exception as e:
            logger.warning(f"Failed to load '{model_size}' model: {e}")
            logger.warning("Falling back to 'base' (CPU/int8)")
            self.model = WhisperModel("base", device="cpu", compute_type="int8")
             
        logger.info(f"Whisper model loaded.")
        
        # Hallucination Blocklist (Common subtitle artifacts)
        self.HALLUCINATIONS = {
            "Thank you.", "Thanks for watching.", "You", 
            "MBC", "Amara.org", "Subtitles by", "Subtitles",
            "Copyright", "©"
        }
    
    def filter_hallucinations(self, text: str) -> str:
        if not text: return ""
        cleaned = text.strip().lower()
        
        # Exact match check (case-insensitive)
        for h in self.HALLUCINATIONS:
            if cleaned == h.lower():
                return ""
        
        # Prefix check (case-insensitive) for "Thank you" artifacts
        if cleaned.startswith("thank you") and len(cleaned) < 15:
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

# Global ASR instance is initialized in the lifespan
# asr_engine = MedicalASR()

async def spawn_agent(room_name: str):
    """
    Directly joins a room as a participant to act as an agent.
    This bypasses the LiveKit Job system for guaranteed connection.
    """
    room = rtc.Room()
    
    @room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
             if participant.identity == "Agent-AI": return
             logger.info(f"[AGENT] Processing audio track {track.sid} from {participant.identity}")
             asyncio.create_task(process_audio_track(room, track, participant, participant_configs))

    @room.on("track_published")
    def on_track_published(publication, participant):
        if publication.kind == rtc.TrackKind.KIND_AUDIO:
            if participant.identity == "Agent-AI": return
            publication.set_subscribed(True)

    # Store settings per participant (e.g. language)
    participant_configs = {}

    @room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        if data.topic == "config":
            try:
                msg = json.loads(data.data)
                if msg.get("type") == "config":
                    identity = data.participant.identity
                    lang = msg.get("language", "en")
                    participant_configs[identity] = {"language": lang}
                    logger.info(f"[AGENT] Language set to '{lang}' for {identity}")
            except Exception as e:
                logger.error(f"[AGENT] Error processing config: {e}")

    try:
        # Generate Agent Token
        token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET) \
            .with_identity("Agent-AI") \
            .with_name("Transcription Agent") \
            .with_grants(api.VideoGrants(room_join=True, room=room_name, can_subscribe=True, can_publish=True)) \
            .to_jwt()
            
        await room.connect(LIVEKIT_URL, token)
        logger.info(f"[AGENT] Successfully joined room: {room_name}")
        
        # Subscribe to existing tracks
        for participant in room.remote_participants.values():
            if participant.identity == "Agent-AI": continue # Don't subscribe to self
            for publication in participant.track_publications.values():
                if publication.kind == rtc.TrackKind.KIND_AUDIO:
                    publication.set_subscribed(True)

        # KEEP ALIVE LOOP: Stay in room as long as there is at least one remote participant
        # (Wait 10s initially to allow user to connect)
        await asyncio.sleep(10)
        while len(room.remote_participants) > 0:
            await asyncio.sleep(5)
            
        logger.info(f"[AGENT] Participant left, cleaning up room: {room_name}")
        await room.disconnect()

    except Exception as e:
        logger.error(f"[AGENT] Room {room_name} error: {e}")

async def process_audio_track(room: rtc.Room, track, participant, participant_configs):
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
        
        if check_peak < 0.001: return # Increased sensitivity

        process_start = time.time()
        loop = asyncio.get_running_loop()
        
        def do_transcribe(data, lang):
            segments, _ = asr_engine.model.transcribe(
                data, beam_size=1, language=lang, vad_filter=True,
                vad_parameters=dict(min_speech_duration_ms=150),
                no_speech_threshold=0.6
            )
            raw_text = " ".join([s.text for s in segments]).strip()
            if raw_text:
                logger.info(f"[AGENT MODE] 👂 Whisper heard: '{raw_text}'")
            return asr_engine.filter_hallucinations(raw_text)

        try:
            # Removed timeout as requested - let it run until finished
            # full_transcription = await asyncio.wait_for(
            #     loop.run_in_executor(inference_executor, do_transcribe, audio_data, lang_code), 
            #     timeout=15.0
            # )
            full_transcription = await loop.run_in_executor(inference_executor, do_transcribe, audio_data, lang_code)
            
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
                await room.local_participant.publish_data(payload, topic="transcription", reliable=True)
                
                logger.info(f"[AGENT MODE] 📤 Sent to UI: '{full_transcription}' ({turnaround_ms}ms)")
            else:
                logger.info("[AGENT MODE] 🔕 Filtered/Empty result")
        except asyncio.TimeoutError:
            logger.warning(f"[AGENT MODE] ⏳ Transcription timed out after 15s (Model too slow for CPU?)")
        except Exception as e:
            logger.error(f"[AGENT MODE] ❌ Task failed: {type(e).__name__} - {e}")
            import traceback
            logger.error(traceback.format_exc())

    # Main Loop
    processing_task = None
    frame_count = 0
    try:
        async for event in audio_stream:
            await asyncio.sleep(0)
            audio_buffer.extend(event.frame.data.tobytes())
            
            frame_count += 1
            if frame_count % 2000 == 0:
                 logger.info(f"[AGENT] Audio session active for {participant.identity}...")

            # Dynamic Batching
            if len(audio_buffer) >= BUFFER_SIZE_BYTES:
                # If busy, keep buffering (don't clear!)
                if processing_task and not processing_task.done():
                    # Cap buffer to 10s of audio to prevent runaway memory
                    if len(audio_buffer) > SAMPLE_RATE * BYTES_PER_SAMPLE * 10:
                        audio_buffer = audio_buffer[-(SAMPLE_RATE * BYTES_PER_SAMPLE * 10):]
                    continue 
                
                # Ready to process - Move data to numpy
                # TAKE ALL DATA we have accumulated while busy (up to 30s)
                # This ensures we don't lose speech that happened while transcribing.
                audio_np = np.frombuffer(audio_buffer, dtype=np.int16).astype(np.float32) / 32768.0
                
                # CLEAR logic: We clear because we are about to process EVERYTHING in audio_np
                audio_buffer.clear()
                
                # Launch background task
                current_lang = participant_configs.get(participant.identity, {}).get("language", "en")
                processing_task = asyncio.create_task(process_step(audio_np, current_lang))


    except asyncio.CancelledError:
        logger.info(f"[AGENT MODE] 🛑 Audio processing task cancelled for {participant.identity}")
        return # Exit cleanly


# --- Main Application Runner ---

if __name__ == "__main__":
    print(f"Starting Unified Server (API + Agent on Port {API_PORT})...")
    # Single Process, Single Loop, Maximum Stability
    uvicorn.run(app, host="0.0.0.0", port=API_PORT)
