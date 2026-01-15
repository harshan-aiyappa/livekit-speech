# Vocalize Documentation

**Real-Time Speech Transcription Application**

---

## 📚 Documentation Index

### Architecture & Design

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Comprehensive architecture analysis
  - Current hybrid approach (LiveKit + WebSocket)
  - Alternative patterns comparison
  - Performance metrics & optimization
  - Cost analysis
  - Migration recommendations

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- FFmpeg installed

### Backend Setup
```bash
cd backend
python -m venv venv311
venv311\Scripts\activate  # Windows
pip install -r requirements.txt
python main.py dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
Create `.env` file:
```env
LIVEKIT_URL=wss://your-livekit-url
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret
```

---

## 🎯 Key Features

- ✅ **Real-time Speech Transcription** (Whisper base model)
- ✅ **Persistent Connection** (instant record/stop)
- ✅ **Modern UI** (monochrome theme, animations)
- ✅ **Performance Metrics** (turnaround time tracking)
- ✅ **Audio Visualization** (40-bar animated visualizer)
- ✅ **Export Transcripts** (copy & download)

---

## 📊 Technology Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- LiveKit Client (WebRTC)
- WebSocket API

### Backend
- FastAPI (Python web framework)
- faster-whisper (CPU-optimized Whisper)
- LiveKit SDK
- FFmpeg (audio conversion)
- PyDub (audio processing)

---

## 🏗️ Project Structure

```
livekit-speech/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Page components
│   │   ├── shared/        # Shared types/schemas
│   │   └── lib/           # Utilities
│   └── public/            # Static assets
│
├── backend/               # FastAPI server
│   ├── main.py           # Main application entry
│   ├── requirements.txt  # Python dependencies
│   └── venv311/          # Python 3.11 virtual env
│
├── docs/                 # Documentation
│   ├── README.md         # This file
│   └── ARCHITECTURE.md   # Architecture analysis
│
└── .env                  # Environment configuration
```

---

## 🎨 Design System

### Theme: Premium Monochrome
- **Colors**: Black, Grey, White with subtle gradients
- **Fonts**: 
  - Headings: 'Outfit'
  - UI: 'Plus Jakarta Sans'
- **Style**: No borders, shadows & glassmorphism
- **Dark/Light**: Full theme support

### Color Palette
```css
/* Light Mode */
--background: 0 0% 100%
--foreground: 0 0% 3.9%
--primary: 222.2 47.4% 11.2%

/* Dark Mode */
--background: 0 0% 3.9%
--foreground: 0 0% 98%
--primary: 210 40% 98%
```

---

## ⚡ Performance Optimizations

### Backend
1. **Whisper Configuration**
   - Model: `base` (140MB)
   - Device: CPU with INT8 quantization
   - Disabled compression ratio checks
   - Single-pass decoding (temperature=0)
   - **Result**: 2-5s processing time (was 30-40s)

2. **Smart Chunk Filtering**
   - Minimum size: 40KB
   - Skips incomplete/corrupt chunks
   - Prevents FFmpeg errors

3. **Persistent Connection**
   - Room created once on page load
   - Instant record/stop (no reconnection)
   - Connection stays alive during session

### Frontend
1. **Code Splitting** (Vite)
2. **Lazy Loading** (React)
3. **Optimized Re-renders** (React hooks)
4. **60fps Animations** (Canvas-based visualizer)

---

## 📈 Metrics & Monitoring

### Turnaround Time (TAT)
- **Measurement**: Audio received → Transcript returned
- **Target**: < 5 seconds
- **Current**: 2-5 seconds ✅
- **Display**: Green badge on each transcript

### Audio Levels
- **Real-time monitoring**: 60fps updates
- **Color-coded**: 
  - 🟢 Green (70-100%): Optimal
  - 🟡 Yellow (40-69%): Medium
  - 🔵 Blue (10-39%): Soft
  - ⚪ Gray (0-9%): Silent

---

## 🔐 Security Best Practices

### Development
- ✅ Environment variables for secrets
- ✅ CORS configured
- ✅ JWT tokens for LiveKit

### Production (TODO)
- [ ] Use WSS (WebSocket Secure)
- [ ] Add WebSocket authentication
- [ ] Implement rate limiting
- [ ] Input validation & sanitization
- [ ] HTTPS only

---

## 🐛 Troubleshooting

### Backend Issues

**FFmpeg not found:**
```bash
# Install via winget
winget install Gyan.FFmpeg
```

**Python version issues:**
```bash
# Use Python 3.11 (not 3.14)
python --version  # Should show 3.11.x
```

**Model download fails:**
- Check internet connection
- Whisper models download from HuggingFace
- ~140MB for base model

### Frontend Issues

**Build errors:**
```bash
# Clear cache
rm -rf node_modules
npm install
```

**WebSocket connection fails:**
- Verify backend is running on port 8000
- Check CORS configuration
- Ensure proxy is configured in vite.config.ts

---

## 📝 API Reference

### WebSocket Endpoint

**URL**: `ws://localhost:8000/ws`

**Client → Server Messages:**
```json
{
  "type": "audio_chunk",
  "data": "base64_encoded_audio",
  "timestamp": 0
}
```

**Server → Client Messages:**
```json
{
  "type": "status",
  "whisper_ready": true,
  "mode": "live"
}

{
  "type": "transcript",
  "text": "transcribed text",
  "timestamp": 0,
  "isFinal": true,
  "confidence": 1.0,
  "turnaround_ms": 2450
}

{
  "type": "error",
  "message": "error description"
}
```

### HTTP Endpoints

**Health Check:**
```
GET /api/health
Response: { "status": "ok" }
```

**Token Generation:**
```
POST /api/livekit/token
Body: { "room_name": "...", "participant_name": "..." }
Response: { "token": "...", "livekit_url": "..." }
```

---

## 🤝 Contributing

### Development Workflow
1. Create feature branch
2. Make changes
3. Test locally
4. Update documentation
5. Submit PR

### Code Style
- **Python**: Follow PEP 8
- **TypeScript**: Use ESLint + Prettier
- **Commits**: Conventional commits format

---

## 📄 License

[Add your license here]

---

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review ARCHITECTURE.md
3. Create GitHub issue
4. Contact development team

---

**Last Updated**: January 15, 2026  
**Version**: 1.0.0
