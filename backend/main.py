import os
import asyncio
import json
import logging
import signal
import threading
import time
from dotenv import load_dotenv

# LiveKit & Signal Processing
from livekit import api, agents, rtc
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
# Silence verbose AI logs
logging.getLogger("faster_whisper").setLevel(logging.WARNING)

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
    
    # Initialize ASR engine and session buffer
    global asr_engine
    if not asr_engine:
        asr_engine = MedicalASR()
    
    # Buffer to accumulate WebM chunks (must keep the header at the start)
    session_audio_buffer = bytearray()
    last_process_time = time.time()
    
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
                    process_start = time.time()
                    audio_base64 = data.get("data", "")
                    audio_bytes = base64.b64decode(audio_base64)
                    
                    # Accumulate bytes
                    session_audio_buffer.extend(audio_bytes)
                    
                    # Process every ~1 second or so to keep UI snappy
                    # (Don't process tiny 250ms chunks individually to save CPU)
                    if time.time() - last_process_time < 0.8:
                        continue
                        
                    last_process_time = time.time()
                    
                    try:
                        # Convert the FULL accumulated buffer to WAV
                        # FFmpeg needs the header at the start of the buffer to work
                        audio = AudioSegment.from_file(io.BytesIO(session_audio_buffer), format="webm")
                        
                        # Only take the last 15 seconds to keep it fast
                        if len(audio) > 15000:
                            audio = audio[-15000:]
                            
                        audio = audio.set_channels(1).set_frame_rate(16000)
                        
                        # Export to WAV in memory
                        wav_buffer = io.BytesIO()
                        audio.export(wav_buffer, format="wav")
                        wav_buffer.seek(0)
                        
                        # Save to temp file for Whisper (needs a path or file-like object)
                        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
                            temp_wav.write(wav_buffer.read())
                            temp_wav_path = temp_wav.name
                        
                        # Transcribe in executor
                        def run_transcription(path, lang):
                            segments, _ = asr_engine.model.transcribe(
                                path,
                                beam_size=1,
                                language=lang,
                                vad_filter=True,
                                no_speech_threshold=0.6
                            )
                            return " ".join([s.text for s in segments]).strip()

                        loop = asyncio.get_running_loop()
                        transcribed_text = await loop.run_in_executor(
                            None, 
                            run_transcription, 
                            temp_wav_path, 
                            data.get("language", "en")
                        )
                        
                        # Cleanup temp file
                        try:
                            os.unlink(temp_wav_path)
                        except:
                            pass

                        if transcribed_text:
                            process_end = time.time()
                            turnaround_ms = int((process_end - process_start) * 1000)
                            
                            await websocket.send_json({
                                "type": "transcript",
                                "text": transcribed_text,
                                "timestamp": data.get("timestamp", 0),
                                "isFinal": True,
                                "turnaround_ms": turnaround_ms
                            })
                                "confidence": 1.0,
                                "id": f"chunk-{data.get('timestamp', 0)}",
                                "turnaround_ms": turnaround_ms  # Time taken to process
                            }
                            
                            logger.info(f"[WS MODE] 📤 Sending transcript: '{transcribed_text}' (processed in {turnaround_ms}ms)")
                            await websocket.send_json(transcript_response)
                            logger.info("[WS MODE] ✅ Transcript sent successfully")
                        else:
                            logger.info("[WS MODE] 🔇 No speech detected in audio chunk")
                        
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

# Global ASR instance initialized on startup
asr_engine = MedicalASR()

async def entrypoint(ctx: JobContext):
    """
    Main LiveKit Agent Entrypoint.
    """
    logger.info(f"[AGENT MODE] 🚀 Agent assigned to room: {ctx.room.name}")
    await ctx.connect()
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

async def process_audio_track(ctx: JobContext, track, participant, participant_configs):
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
    BUFFER_SECONDS = 1.5 # Increased from 0.5s to 1.5s for better Whisper context
    BUFFER_SIZE_BYTES = int(SAMPLE_RATE * BYTES_PER_SAMPLE * BUFFER_SECONDS)
    
    logger.info(f"[AGENT MODE] 🎧 Started processing audio for {participant.identity}")
    
    # Transcription loop
    frame_count = 0
    async for event in audio_stream:
        # event is an AudioFrameEvent
        frame = event.frame
        audio_buffer.extend(frame.data.tobytes())
        
        frame_count += 1
        if frame_count % 500 == 0:
            logger.info(f"[AGENT MODE] 📊 Audio stream active (Participant: {participant.identity})")
        
        # If buffer is full enough, process it
        if len(audio_buffer) >= BUFFER_SIZE_BYTES:
            # 1. Extract and clear buffer always
            audio_np = np.frombuffer(audio_buffer, dtype=np.int16).astype(np.float32) / 32768.0
            audio_buffer.clear()
            
            # Check Peak Volume
            peak = np.abs(audio_np).max()
            
            # Skip AI processing if it's mostly silence (Increased to 0.04 to block background hum)
            if peak < 0.04:
                continue

            logger.info(f"[AGENT MODE] 🔊 Sound detected (Peak: {peak:.4f})")
            
            # 2. Transcribe in executor
            try:
                def do_transcribe(data, lang):
                    # ALL heavy lifting must stay in executor
                    segments, _ = asr_engine.model.transcribe(
                        data, 
                        beam_size=1, 
                        language=lang, 
                        vad_filter=True,
                        # Ignore sounds shorter than 250ms (keyboard clicks, bumps)
                        vad_parameters=dict(min_speech_duration_ms=250),
                        # If Whisper is < 60% sure it's speech, ignore it
                        no_speech_threshold=0.6
                    )
                    return " ".join([seg.text for seg in segments]).strip()

                loop = asyncio.get_running_loop()
                # Get current language from configs
                current_lang = participant_configs.get(participant.identity, {}).get("language", "en")
                full_transcription = await loop.run_in_executor(None, do_transcribe, audio_np, current_lang)
                
                if full_transcription:
                    # Boxed log for high visibility
                    text_len = len(full_transcription)
                    logger.info(f"\n╔{'═' * (text_len + 4)}╗\n║  {full_transcription}  ║\n╚{'═' * (text_len + 4)}╝\n")
                    
                    payload = json.dumps({
                        "type": "transcript",
                        "text": full_transcription,
                        "isFinal": True,
                        "timestamp": int(time.time() * 1000),
                        "participantId": participant.identity
                    })
                    
                    await ctx.room.local_participant.publish_data(
                        payload, 
                        reliable=True,
                        topic="transcription"
                    )
                elif peak > 0.05:
                    # Log if there was significant sound but no words detected
                    logger.info(f"[AGENT MODE] 🔇 No speech found (Peak Volume: {peak:.4f})")
            
            except Exception as e:
                logger.error(f"[AGENT MODE] ASR Execution failed: {e}")


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
