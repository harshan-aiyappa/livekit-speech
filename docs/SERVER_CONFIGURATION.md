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

## 3. How to Verify
When you start the backend, check the logs first line:

```
INFO:asr-worker:⏳ Loading Whisper (medium) model on cuda...
```

If it fails to load CUDA, it will auto-fallback to `base` on `cpu`.
