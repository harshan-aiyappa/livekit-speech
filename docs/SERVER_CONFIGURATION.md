# 🎛️ Server Deployment Guide (Whisper Configuration)
### For Office Server / GPU Deployment

Your Application supports dynamic configuration of the AI Model. This allows you to use powerful models (like `large-v3`) on your office server while using smaller models (`tiny`) on laptops.

---

## 1. Environment Variables
Add these to your `.env` file on the server (or user deployment config):

```bash
# 🧠 Model Size
# Options: tiny, base, small, medium, large-v3
# Recommended for Server: medium or large-v3
MODEL_SIZE=medium

# ⚡ Hardware Acceleration
# Options: cpu, cuda (NVIDIA GPU)
# Recommended for Server: cuda 
WHISPER_DEVICE=cuda

# 🧮 Precision
# Options: int8, float16 (best for GPU), int8_float16
# Recommended for GPU: float16
WHISPER_COMPUTE=float16
```

---

## 2. Hardware Recommendations

| Scenario                          | Env Config                                     | Required Hardware                             | Performance                              |
| :-------------------------------- | :--------------------------------------------- | :-------------------------------------------- | :--------------------------------------- |
| **High Accuracy (Office Server)** | `MODEL_SIZE=large-v3`<br>`WHISPER_DEVICE=cuda` | NVIDIA GPU (RTX 3060 / A10 / T4)<br>8GB+ VRAM | 🚀 **Ultra-Accurate**<br>Real-time (50ms) |
| **Balanced (Strong CPU)**         | `MODEL_SIZE=medium`<br>`WHISPER_DEVICE=cpu`    | i7 or Ryzen 7<br>16GB RAM                     | ⚡ **Good**<br>~1s latency                |
| **Fastest (Development)**         | `MODEL_SIZE=tiny`<br>`WHISPER_DEVICE=cpu`      | Any Modern Laptop                             | 🏎️ **Instant**<br>Lower accuracy          |

---

## 4. LiveKit Server Configuration
You can switch between the **Cloud/Office** LiveKit server and a **Local** LiveKit server by updating the credentials in your `.env` file.

### **Cloud / Office Server (Remote)**
Use this for team collaboration or mobile testing via Ngrok.
```bash
LIVEKIT_URL=wss://your-office-server.livekit.cloud
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret
```

### **Local Server (Offline)**
Use this for private development without internet.
1.  **Run LiveKit locally** (using Docker):
    ```bash
    docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit server --dev
    ```
2.  **Update `.env`**:
    ```bash
    LIVEKIT_URL=ws://localhost:7880
    LIVEKIT_API_KEY=devkey
    LIVEKIT_API_SECRET=secret
    ```

---

## 5. How to Verify
When you start the backend, check the initialization logs:

```text
INFO:asr-worker:⏳ Loading Whisper (medium) model on cuda...
INFO:asr-worker:🤖 [LIFESPAN] Starting LiveKit Agent...
INFO:livekit.agents:starting worker
INFO:livekit.agents:registered worker
```

If the agent fails to connect, verify your `LIVEKIT_URL` matches your server's address.
