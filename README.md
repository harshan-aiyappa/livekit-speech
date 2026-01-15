# 🎙️ Vocalize - Real-Time Speech Practice
**Developed by Harshan Aiyappa**

![Status](https://img.shields.io/badge/Status-Production%20Ready-green) Whisper AI

> ⚠️ **iOS Compatibility**: Current implementation may not work on iOS Safari.  
> See [iOS Compatibility Guide](./docs/IOS_COMPATIBILITY.md) for solutions.

---

## Quick Start

### 1. Backend Setup
```bash
cd backend
python -m venv venv311
venv311\Scripts\activate
pip install -r requirements.txt
python main.py dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Configure `.env`
```env
LIVEKIT_URL=wss://kimo-zg71lj4i.livekit.cloud
LIVEKIT_API_KEY=your-key-here
LIVEKIT_API_SECRET=your-secret-here
```

### 4. Open App
Navigate to: `http://localhost:5173`

---

## Features

- ✅ Real-time speech transcription (Whisper base model)
- ✅ Instant record/stop (persistent connection)
- ✅ Audio visualization with percentage
- ✅ Turnaround time tracking
- ✅ Export transcripts (copy/download)
- ✅ Modern UI (dark/light mode)

---

## Tech Stack

**Frontend:** React + TypeScript + Vite + Tailwind  
**Backend:** FastAPI + faster-whisper + FFmpeg  
**Connection:** WebSocket + LiveKit (WebRTC)

---

## Project Structure

```
├── frontend/          # React app
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # useLiveKit
│   │   └── pages/        # TestMode, Home
│   └── vite.config.ts
│
├── backend/           # FastAPI server
│   ├── main.py       # WebSocket + Whisper
│   └── requirements.txt
│
└── docs/             # Documentation
```

---

## Performance

- **Model**: Whisper `base` (140MB, CPU optimized)
- **Transcription**: 2-5 seconds
- **Chunk Size**: 40KB minimum
- **Audio Format**: WebM → WAV → Whisper

---

## Development

### Hot Reload
Both frontend and backend support hot reload

### Debugging
- Frontend: Browser DevTools
- Backend: Terminal logs with emoji indicators

### Testing
```bash
# Record audio and check:
1. Audio level animates (0-100%)
2. Transcript appears within 5s
3. TAT badge shows processing time
```

---

## Architecture Decision

### Current: Hybrid (LiveKit + WebSocket)
- LiveKit: Room management
- WebSocket: Transcription pipeline

### ⚠️ Recommendation: Simplify to WebSocket-Only
**Why:** Single-user app doesn't need LiveKit complexity

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed analysis

---

## ⚖️ Pros & Cons

### Current Implementation (Hybrid)

**Pros:**
- ✅ Works reliably with persistent connection
- ✅ Fast transcription (2-5s TAT)
- ✅ Modern UI with animations
- ✅ Base Whisper model (good accuracy)

**Cons:**
- ❌ Two connections (redundant)
- ❌ LiveKit costs in production
- ❌ More complex than needed
- ❌ Harder to debug/maintain

### Recommended: WebSocket-Only

**Pros:**
- ✅ **50% less code**
- ✅ **No LiveKit costs**
- ✅ **Simpler to understand**
- ✅ **Lower latency**
- ✅ **Perfect for single-user apps**

**Cons:**
- ⚠️ No built-in multi-user support
- ⚠️ Requires manual connection handling

### When to Use Each

| Use Case | Current (Hybrid) | Recommended (WebSocket) |
|----------|-----------------|------------------------|
| **Speech practice (single-user)** | ⚠️ Works but overkill | ✅ **Best choice** |
| **Multi-user collaboration** | ⚠️ Incomplete | ❌ Need LiveKit Agents |
| **Quick prototype** | ❌ Too complex | ✅ **Perfect** |
| **Enterprise features** | ⚠️ Missing features | ❌ Need full LiveKit |

**Bottom Line:** For this speech practice app, **WebSocket-Only is the winner** 🏆

---

## Troubleshooting

**FFmpeg not found:**
```bash
winget install Gyan.FFmpeg
```

**Port already in use:**
- Backend needs port 8000
- Frontend needs port 5173

**Slow transcription (>10s):**
- Check Python version (use 3.11, not 3.14)
- Verify Whisper optimizations in `main.py`

---

## API

### WebSocket: `/ws`
```javascript
// Send audio
ws.send(JSON.stringify({
  type: "audio_chunk",
  data: base64Audio,
  timestamp: Date.now()
}))

// Receive transcript
{
  type: "transcript",
  text: "...",
  turnaround_ms: 2450
}
```

---

## Documentation

- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Deep dive architecture analysis
- **[docs/README.md](./docs/README.md)** - Comprehensive reference

---

## License

[Your License]

---

**Status**: ✅ Production-ready  
**Version**: 1.0.0  
**Last Updated**: January 15, 2026
