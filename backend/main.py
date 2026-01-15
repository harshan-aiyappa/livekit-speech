import os
import asyncio
import json
import logging
import signal
import threading
from dotenv import load_dotenv

# LiveKit & Signal Processing
from livekit import api, agents
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.plugins import silero
import numpy as np

# ASR
from faster_whisper import WhisperModel

# Web Server
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import base64

# Load env vars
load_dotenv()

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("asr-worker")

# --- Configuration ---
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
API_PORT = int(os.getenv("API_PORT", 8000))

if not all([LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET]):
    logger.error("❌ LiveKit credentials missing. Check .env file.")
    exit(1)

# --- FastAPI Setup (Token Server) ---
app = FastAPI(title="LiveKit Voice Agent API")
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
    return {"status": "ok"}

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
    logger.info("🔌 WebSocket client connected")
    
    # Initialize ASR engine if not already loaded
    global asr_engine
    if not asr_engine:
        asr_engine = MedicalASR()
    
    # Send status to client
    await websocket.send_json({
        "type": "status",
        "whisper_ready": True,
        "mode": "live"
    })
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            logger.info(f"📨 Received WebSocket message type: {data.get('type')}")
            
            if data.get("type") == "audio_chunk":
                try:
                    # Track processing start time
                    import time
                    process_start = time.time()
                    
                    # Decode base64 audio data
                    audio_base64 = data.get("data", "")
                    audio_bytes = base64.b64decode(audio_base64)
                    
                    logger.info(f"🎵 Received audio chunk: {len(audio_bytes)} bytes")
                    
                    # Skip chunks smaller than 40KB (likely incomplete/corrupt or too short)
                    if len(audio_bytes) < 40000:
                        logger.warning(f"⚠️ Skipping small audio chunk ({len(audio_bytes)} bytes) - likely incomplete or too short for accurate transcription")
                        continue
                    
                    # Save audio chunk to temporary file
                    import tempfile
                    import io
                    from pydub import AudioSegment
                    # Configure ffmpeg path
                    import shutil
                    import os
                    
                    ffmpeg_path = shutil.which("ffmpeg")
                    if not ffmpeg_path:
                        # Try common installation paths
                        possible_paths = [
                            r"C:\ProgramData\chocolatey\bin\ffmpeg.exe",
                            r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
                            r"C:\ffmpeg\bin\ffmpeg.exe",
                            os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe"),
                        ]
                        for path in possible_paths:
                            if os.path.exists(path):
                                ffmpeg_path = path
                                break
                    
                    if ffmpeg_path:
                        # Add ffmpeg directory to PATH so pydub can find both ffmpeg and ffprobe
                        ffmpeg_dir = os.path.dirname(ffmpeg_path)
                        os.environ["PATH"] += os.pathsep + ffmpeg_dir
                        
                        AudioSegment.converter = ffmpeg_path
                        # Also set ffprobe path manually if possible, though adding to PATH usually fixes it
                        AudioSegment.ffprobe = os.path.join(ffmpeg_dir, "ffprobe.exe")
                        
                        logger.info(f"🔧 configured ffmpeg/ffprobe at: {ffmpeg_dir}")
                    else:
                        logger.error("❌ ffmpeg not found! Install ffmpeg first.")
                        raise FileNotFoundError("ffmpeg not found")
                    
                    # Save audio chunk to temporary file
                    import tempfile
                    import io
                    from pydub import AudioSegment
                    
                    # Create temporary WebM file
                    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_webm:
                        temp_webm.write(audio_bytes)
                        temp_webm_path = temp_webm.name
                    
                    logger.info(f"💾 Saved WebM to: {temp_webm_path}")
                    
                    try:
                        # Convert WebM to WAV using pydub
                        logger.info("🔄 Converting WebM to WAV...")
                        audio = AudioSegment.from_file(temp_webm_path, format="webm")
                        
                        # Convert to mono, 16kHz (Whisper's preferred format)
                        audio = audio.set_channels(1)
                        audio = audio.set_frame_rate(16000)
                        
                        # Export to WAV in memory
                        wav_buffer = io.BytesIO()
                        audio.export(wav_buffer, format="wav")
                        wav_buffer.seek(0)
                        
                        # Save to temporary WAV file for Whisper
                        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
                            temp_wav.write(wav_buffer.read())
                            temp_wav_path = temp_wav.name
                        
                        logger.info(f"✅ Converted to WAV: {temp_wav_path}")
                        
                        # Transcribe using Whisper - OPTIMIZED FOR SPEED
                        logger.info("🧠 Running Whisper transcription...")
                        segments, info = asr_engine.model.transcribe(
                            temp_wav_path,
                            beam_size=1,  # Fast decoding
                            language="en",
                            vad_filter=True,
                            vad_parameters=dict(min_silence_duration_ms=500),
                            # SPEED OPTIMIZATIONS - disable quality checks that slow down processing
                            condition_on_previous_text=False,  # Don't use context (faster)
                            compression_ratio_threshold=None,  # Disable compression checks (was causing 37s delays!)
                            logprob_threshold=None,  # Disable quality checks
                            no_speech_threshold=0.6,  # Standard threshold
                            temperature=0.0  # Deterministic, no retries
                        )
                        
                        # Extract text from segments
                        transcribed_text = " ".join([segment.text for segment in segments]).strip()
                        
                        logger.info(f"📝 Transcription: '{transcribed_text}'")
                        
                        # Send transcription back to client
                        if transcribed_text:
                            # Calculate processing time
                            process_end = time.time()
                            turnaround_ms = int((process_end - process_start) * 1000)
                            
                            transcript_response = {
                                "type": "transcript",
                                "text": transcribed_text,
                                "timestamp": data.get("timestamp", 0),
                                "isFinal": True,
                                "confidence": 1.0,
                                "id": f"chunk-{data.get('timestamp', 0)}",
                                "turnaround_ms": turnaround_ms  # Time taken to process
                            }
                            
                            logger.info(f"📤 Sending transcript: '{transcribed_text}' (processed in {turnaround_ms}ms)")
                            await websocket.send_json(transcript_response)
                            logger.info("✅ Transcript sent successfully")
                        else:
                            logger.info("🔇 No speech detected in audio chunk")
                        
                        # Clean up temporary files
                        import os
                        try:
                            os.unlink(temp_webm_path)
                            os.unlink(temp_wav_path)
                        except:
                            pass
                            
                    except Exception as conversion_error:
                        logger.error(f"❌ Audio conversion/transcription error: {conversion_error}")
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Conversion error: {str(conversion_error)}"
                        })
                    
                except Exception as e:
                    logger.error(f"❌ Error processing audio chunk: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e)
                    })
    
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
        logger.info("⏳ Loading Whisper (base) model...")
        # Run on CPU with int8 quantization for speed/compatibility
        self.model = WhisperModel("base", device="cpu", compute_type="int8")
        logger.info("✅ Whisper loaded.")
        
        # VAD State (Simple Energy-based or WebRTCVAD)
        # We will use simple energy/VAD logic in the processing loop
        
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

# Global ASR instance
asr_engine = None

async def entrypoint(ctx: JobContext):
    """
    Main LiveKit Agent Entrypoint.
    Called when a new job (room connection) is assigned to this worker.
    """
    global asr_engine
    if not asr_engine:
        asr_engine = MedicalASR()

    logger.info(f"🚀 Agent connecting to room: {ctx.room.name}")
    await ctx.connect()
    logger.info(f"✅ Connected to room: {ctx.room.name}")

    # Subscribe to all audio tracks from users
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        if track.kind == "audio":
            logger.info(f"🎤 Subscribed to audio from {participant.identity}")
            asyncio.create_task(process_audio_track(ctx, track, participant))

    # Wait for the job to close
    # ctx.wait_for_shutdown() is handled by the worker framework usually, 
    # but we can keep the coroutine alive if needed.

async def process_audio_track(ctx: JobContext, track, participant):
    """
    Reads audio frames from the track, buffers them, and runs ASR.
    """
    # Create an audio stream (yielding AudioFrames)
    audio_stream = agents.utils.AudioStream(track)
    
    # We will accumulate audio data (PCM 16kHz mono)
    audio_buffer = bytearray()
    
    # Configuration
    SAMPLE_RATE = 16000
    BYTES_PER_SAMPLE = 2 # int16
    BUFFER_SECONDS = 3.0 
    BUFFER_SIZE_BYTES = int(SAMPLE_RATE * BYTES_PER_SAMPLE * BUFFER_SECONDS)
    
    logger.info(f"🎧 Started processing audio for {participant.identity}")
    
    # Transcription loop
    async for frame in audio_stream:
        # frame.data is the raw PCM bytes
        audio_buffer.extend(frame.data.tobytes())
        
        # If buffer is full enough, process it
        if len(audio_buffer) >= BUFFER_SIZE_BYTES:
            # 1. Prepare chunks
            # In a real VAD app, we would split on silence.
            # Here for minimal viability, we transcribe the whole chunk.
            
            # Convert to numpy for faster-whisper (float32)
            # 16-bit int -> float32
            audio_np = np.frombuffer(audio_buffer, dtype=np.int16).astype(np.float32) / 32768.0
            
            # 2. Transcribe
            # Run in executor to avoid blocking the async event loop
            try:
                loop = asyncio.get_running_loop()
                text = await loop.run_in_executor(
                    None, 
                    # Use a lambda or partial to pass arguments
                    lambda: asr_engine.model.transcribe(audio_np, beam_size=1, language="en")[0]
                )
                
                # 'text' is a generator of segments
                full_transcription = " ".join([seg.text for seg in text]).strip()
                
                if full_transcription:
                    logger.info(f"📝 Transcript [{participant.identity}]: {full_transcription}")
                    
                    # 3. Send back to frontend via Data Packet
                    # The message format matches what the frontend expects
                    payload = json.dumps({
                        "type": "transcript",
                        "text": full_transcription,
                        "isFinal": True,
                        "timestamp": int(time.time() * 1000),
                        "participantId": participant.identity
                    })
                    
                    await ctx.room.local_participant.publish_data(
                        payload, 
                        topic="transcription",
                        reliable=True
                    )
            
            except Exception as e:
                logger.error(f"ASR Error: {e}")
            
            # Reset buffer usually, or sliding window.
            # Simple approach: clear buffer
            audio_buffer.clear()


# --- Main Application Runner ---

def run_fastapi():
    config = uvicorn.Config(app, host="0.0.0.0", port=API_PORT, loop="asyncio")
    server = uvicorn.Server(config)
    asyncio.run(server.serve())

def run_worker():
    # Initialize the worker
    # Note: cli.run_app is blocking, so we need to run it carefully or use dev runner
    # For this hybrid setup (FastAPI + Worker in one process), we start FastAPI in a thread
    # and run the Worker in the main thread (or vice versa).
    # LiveKit Agents usually want main thread for signals.
    
    # Start FastAPI in background thread
    t = threading.Thread(target=run_fastapi, daemon=True)
    t.start()
    
    # Run Agent
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))

if __name__ == "__main__":
    # Check for arguments to decide mode, or just run both for 'dev'
    print(f"🚀 Starting Hybrid Server (API on {API_PORT} + LiveKit Worker)...")
    
    # We use a slight hack to run both: 
    # run_app() blocks, so we launch API first.
    t = threading.Thread(target=run_fastapi, daemon=True)
    t.start()
    
    # Run the worker listener
    # Default to 'dev' mode if no command provided
    import sys
    if len(sys.argv) == 1:
        sys.argv.append("dev")
        
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
