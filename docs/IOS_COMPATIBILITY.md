# iOS Compatibility Guide

**Main Objective**: Solve iOS Safari audio recording and transcription challenges

---

## 🎯 The iOS Problem

### Core Issues

iOS Safari has **severe restrictions** on web audio APIs:

1. ❌ **MediaRecorder API**: Limited codec support
2. ❌ **WebSocket**: Unreliable on background
3. ❌ **AutoPlay**: Strict policies
4. ❌ **Audio Context**: Requires user gesture
5. ❌ **Background Audio**: Suspended when app backgrounded

### Why This Matters

Your speech practice app **must work on iOS** because:
- 📱 50%+ mobile users are on iPhone
- 🎤 Speech practice is a mobile-first use case
- 🚫 **Current implementation likely fails on iOS Safari**

---

## 🔍 Current Implementation Analysis

### What We're Using Now

```javascript
// ❌ PROBLEM: This won't work on iOS Safari!
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: "audio/webm;codecs=opus"  // iOS doesn't support WebM!
});
```

### iOS Safari Limitations

| Feature | Desktop | iOS Safari | Status |
|---------|---------|------------|--------|
| **MediaRecorder** | ✅ WebM/Opus | ❌ Only WAV/MP4 | 🔴 **BROKEN** |
| **WebSocket** | ✅ Full support | ⚠️ Background issues | 🟡 **FLAKY** |
| **Audio Context** | ✅ Always works | ❌ Needs gesture | 🟡 **LIMITED** |
| **getUserMedia** | ✅ Works | ✅ Works (with prompt) | 🟢 **OK** |

---

## ✅ Solutions for iOS

### 🖼️ Visual Decision Guide

![iOS Solution Approaches](./images/ios_solution_approaches.png)

### 📊 Comparative Analysis

![iOS Approach Comparison](./images/ios_approach_comparison.png)

| Approach | Compatibility | Complexity | Performance | Best For |
|----------|---------------|------------|-------------|----------|
| **1. Multi-Codec** (Recommended) | ✅ High (iOS 14+) | 🟢 Low | ⚡ High | Most Apps |
| **2. Web Audio API** | ✅✅ Maximum | 🔴 High | ⚠️ Medium | Specialized Audio |
| **3. React Native** | ✅✅ Native | 🔴 Very High | ⚡⚡ Native | Full Mobile Apps |
| **4. PWA** | ⚠️ Limited | 🟡 Medium | ⚡ High | Simple Tools |

---

### Solution 1: Multi-Codec Support (Recommended) ⭐

**Strategy**: Detect iOS and use compatible codecs

```javascript
// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// Choose codec based on platform
const mimeType = isIOS 
  ? "audio/mp4"              // iOS supports MP4
  : "audio/webm;codecs=opus" // Desktop uses WebM

const mediaRecorder = new MediaRecorder(stream, { mimeType });
```

**Pros:**
- ✅ Works on both iOS and Desktop
- ✅ Simple fallback mechanism
- ✅ No external dependencies

**Cons:**
- ⚠️ MP4 files larger than WebM
- ⚠️ Need to handle both formats in backend

---

### Solution 2: Web Audio API + Manual Encoding

**Strategy**: Use ScriptProcessor/AudioWorklet to capture raw PCM

```javascript
// Create audio context
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(stream);

// Use AudioWorklet (modern) or ScriptProcessor (fallback)
const processor = new AudioWorkletNode(audioContext, 'recorder-worklet');

processor.port.onmessage = (e) => {
  const pcmData = e.data; // Raw PCM samples
  
  // Option A: Send directly (no encoding)
  ws.send(pcmData);
  
  // Option B: Encode to WAV client-side
  const wav = encodeWAV(pcmData);
  ws.send(wav);
};
```

**Pros:**
- ✅ **Full iOS compatibility**
- ✅ Direct PCM access (best quality)
- ✅ Works in all browsers

**Cons:**
- ❌ More complex implementation
- ❌ Larger data size (uncompressed)
- ❌ Higher battery usage

---

### Solution 3: Native App Wrapper (React Native)

**Strategy**: Build native iOS app with web view

```javascript
// React Native with WebRTC
import { mediaDevices } from 'react-native-webrtc';

const stream = await mediaDevices.getUserMedia({ audio: true });
// Full native audio access, no Safari limitations
```

**Pros:**
- ✅ **Perfect iOS support**
- ✅ Native performance
- ✅ App Store distribution
- ✅ Push notifications, background audio

**Cons:**
- ❌ Major development effort
- ❌ Need to maintain native code
- ❌ App Store approval process
- ❌ Not a web app anymore

---

### Solution 4: Progressive Web App (PWA)

**Strategy**: PWA with iOS-specific optimizations

```javascript
// Manifest.json
{
  "display": "standalone",
  "orientation": "portrait",
  "ios": {
    "supportsAudio": true
  }
}

// Service Worker for offline support
self.addEventListener('fetch', (event) => {
  // Cache audio processing workers
});
```

**Pros:**
- ✅ Install on home screen
- ✅ Better iOS integration
- ✅ Still a web app

**Cons:**
- ⚠️ Still limited by Safari restrictions
- ⚠️ Doesn't solve MediaRecorder issue
- ⚠️ Background audio still limited

---

## 🏆 Recommended Approach

### For Your Speech Practice App:

**Use Solution 1 + Solution 2 Hybrid:**

```javascript
// 1. Detect platform
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

let audioCapture;

if (isIOS) {
  // 2. Use Web Audio API for iOS
  audioCapture = new WebAudioRecorder(stream, {
    encoding: 'wav',
    sampleRate: 16000
  });
} else {
  // 3. Use MediaRecorder for Desktop
  audioCapture = new MediaRecorder(stream, {
    mimeType: "audio/webm;codecs=opus"
  });
}

// 4. Unified interface
audioCapture.ondataavailable = (blob) => {
  ws.send(blob);
};
```

---

## 🔧 Implementation Steps

### Phase 1: Add iOS Detection
```typescript
// utils/platform.ts
export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

export const getSupportedMimeType = () => {
  if (isIOS()) {
    return 'audio/mp4';
  }
  return 'audio/webm;codecs=opus';
};
```

### Phase 2: Update Backend to Handle Multiple Formats
```python
# main.py - Add MP4 support
def process_audio(audio_bytes: bytes, format: str):
    if format == "mp4":
        # Handle MP4
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format="mp4")
    else:
        # Handle WebM
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format="webm")
    
    # Rest is same: convert to WAV, transcribe
```

### Phase 3: Fallback Mechanism
```typescript
// hooks/useAudioRecorder.ts
const getRecorder = async (stream: MediaStream) => {
  const mimeTypes = [
    'audio/webm;codecs=opus',  // Try best quality first
    'audio/webm',
    'audio/mp4',               // iOS fallback
    'audio/wav'                // Final fallback
  ];

  for (const type of mimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return new MediaRecorder(stream, { mimeType: type });
    }
  }

  throw new Error('No supported audio format found');
};
```

### Phase 4: Testing on iOS
```bash
# Test checklist
1. ✅ Microphone permission prompt appears
2. ✅ Audio level visualizer animates
3. ✅ Recording starts without errors
4. ✅ Audio chunks sent to backend
5. ✅ Transcription received within 5s
6. ✅ Works after app backgrounded/foregrounded
7. ✅ Works on both Safari and Chrome iOS
```

---

## 📊 iOS Compatibility Matrix

### Current Status (Before Changes)

| Feature | Desktop Chrome | Desktop Safari | iOS Safari | iOS Chrome |
|---------|---------------|----------------|------------|------------|
| `getUserMedia()` | ✅ | ✅ | ✅ | ✅ |
| MediaRecorder WebM | ✅ | ❌ | ❌ | ❌ |
| MediaRecorder MP4 | ❌ | ⚠️ | ⚠️ | ⚠️ |
| WebSocket | ✅ | ✅ | ⚠️ | ⚠️ |
| Full App | ✅ | ⚠️ | ❌ | ❌ |

### Target Status (After Changes)

| Feature | Desktop Chrome | Desktop Safari | iOS Safari | iOS Chrome |
|---------|---------------|----------------|------------|------------|
| `getUserMedia()` | ✅ | ✅ | ✅ | ✅ |
| Audio Recording | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ✅ | ✅ | ✅ |
| Full App | ✅ | ✅ | ✅ | ✅ |

---

## ⚠️ iOS-Specific Gotchas

### 1. Audio Context Must Be Resumed

```javascript
// ❌ WRONG: AudioContext starts suspended on iOS
const audioContext = new AudioContext();

// ✅ CORRECT: Resume on user gesture
button.onclick = async () => {
  await audioContext.resume();
  // Now can record
};
```

### 2. HTTPS Required

```
❌ http://localhost:5173  → Won't work on real iOS device
✅ https://localhost:5173 → Works (need cert)
✅ https://your-domain.com → Production
```

### 3. Background Limitations

```javascript
// iOS suspends audio after ~30 seconds in background
// Solution: Warn user to keep app in foreground
if (isIOS()) {
  showWarning("Keep app in foreground for best results");
}
```

### 4. File Size Limits

```javascript
// iOS Safari has smaller memory limits
// Solution: Send smaller chunks
const chunkDuration = isIOS() ? 2000 : 3000; // 2s vs 3s
mediaRecorder.start(chunkDuration);
```

---

## 🧪 Testing Strategy

### Local iOS Testing

**Option 1: USB Debugging (Recommended)**
```bash
# 1. Connect iPhone via USB
# 2. Enable Web Inspector on iPhone:
#    Settings → Safari → Advanced → Web Inspector

# 3. On Mac Safari:
#    Develop → [Your iPhone] → localhost:5173
```

**Option 2: ngrok Tunnel**
```bash
# Expose local server to internet
npx ngrok http 5173

# Access from iPhone Safari:
# https://abc123.ngrok.io
```

**Option 3: Local Network**
```bash
# Start Vite with --host
npm run dev -- --host

# Access from iPhone on same WiFi:
# https://192.168.1.x:5173
```

---

## 📱 iOS Best Practices

### 1. Request Permissions Early
```javascript
// Show permission UI on button click
const requestMic = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Permission granted!
  } catch (err) {
    // Show helpful error message
    alert('Microphone access required for speech practice');
  }
};
```

### 2. Handle Background State
```javascript
// Detect app backgrounded
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pause recording
    mediaRecorder.pause();
  } else {
    // Resume
    mediaRecorder.resume();
  }
});
```

### 3. Optimize for Battery
```javascript
// Lower sample rate on mobile
const sampleRate = isIOS() ? 16000 : 48000;

// Reduce visualization frequency
const fps = isIOS() ? 30 : 60;
```

---

## 🚀 Next Steps

### Immediate Actions
1. ✅ Add iOS detection utility
2. ✅ Implement MP4 codec fallback
3. ✅ Update backend to handle MP4
4. ✅ Test on real iOS device

### Future Enhancements
- [ ] PWA manifest for iOS
- [ ] Offline mode support
- [ ] Better error messages for iOS users
- [ ] Performance monitoring for mobile

---

## 📚 Resources

- [iOS Safari Audio Limitations](https://developer.apple.com/documentation/webkit/delivering_video_content_for_safari)
- [MediaRecorder API Compatibility](https://caniuse.com/mediarecorder)
- [WebRTC on iOS](https://webkit.org/blog/11353/webrtc-in-safari-14/)
- [iOS Web Audio Best Practices](https://developer.apple.com/documentation/webaudio)

---

**Critical Success Factor**: The app MUST work on iOS for it to be useful for speech practice! 📱

**Status**: ⚠️ Currently broken on iOS  
**Priority**: 🔴 **HIGH** - Fix immediately  
**Effort**: ~4-8 hours for full iOS support

---

**Last Updated**: January 15, 2026
