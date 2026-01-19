# 🚀 Comprehensive Server Deployment & Strategy Guide
**System:** Vocalis Hybrid STT (Speech-to-Text)  
**Host:** Dell Precision 7820 Workstation  
**Profile:** Dual-Mode (Laptop UI ↔️ High-Power AI Server)

---

## 🏗️ Hardware Architecture & Current State
The "Office Server" is configured as the primary high-accuracy inference engine.

| Component   | specification                     | AI Role                                | Status      |
| :---------- | :-------------------------------- | :------------------------------------- | :---------- |
| **CPU**     | Intel Xeon Gold 6130 (32 Threads) | Parallel User Management               | 🌟 Excellent |
| **RAM**     | 128GB DDR4                        | Large Model Caching (e.g., `large-v3`) | 💎 Elite     |
| **GPU**     | NVIDIA Quadro M4000 (8GB)         | Hardware Inference Acceleration        | ⚠️ legacy    |
| **Storage** | NVMe SSD                          | Model Loading Speed                    | ✅ Fast      |

---

## 🛠️ Implementation Log (Problems & Solutions)
During the Jan 2026 deployment, we resolved several critical blockers.

### 1. Networking & Connection (The 404/401 Errors)
*   **Problem:** Browser showed "404 Not Found" or "401 Unauthorized" when trying to connect to LiveKit.
*   **Cause:** The Frontend was hardcoded to a different LiveKit Cloud than the Backend.
*   **Fix:** Updated `useLiveKit.ts` and `useLiveKitAgent.ts` to be **Server-Aware**. The Frontend now dynamically pulls the correct `LIVEKIT_URL` from the Backend token endpoint.
*   **Fix 2:** Forced auto-conversion of `https` to `wss` in the frontend code to satisfy LiveKit SDK requirements.

### 2. Dependency Resolution (The FFmpeg Warning)
*   **Problem:** `pydub` reported "Couldn't find ffmpeg," causing Hybrid mode to fail audio processing.
*   **Fix:** Installed FFmpeg Essentials and manually injected the path into the `main.py` environment at runtime to bypass Windows System Path refresh issues.

### 3. GPU Optimization (The float16 Fallback)
*   **Problem:** Server fell back to CPU because `large-v3` failed to load in `float16` mode.
*   **Cause:** Quadro M4000 (Maxwell) lacks native FP16 support cores.
*   **Fix:** Specifically configured `.env` to use `int8_float16`. This allows the older GPU to still provide significant acceleration without crashing.

---

## 🌓 Operating Modes (How to Switch)

### **Mode A: Total Local Control (Laptop Only)**
*   **Backend `.env`:** Uncomment **PRESET 1**.
*   **Frontend `vite.config.ts`:** Set proxy to `localhost:8000`.
*   **Use Case:** Quick development, offline use.

### **Mode B: Power Hybrid (Laptop + Dell Server)**
*   **Backend `.env`:** Uncomment **PRESET 2** (On Server).
*   **Frontend `vite.config.ts`:** Set proxy to Server IP (e.g., `10.10.20.225`).
*   **Use Case:** High-accuracy transcription using the `large-v3` model.

---

## 🚀 Recommended Upgrade Roadmap

### 1. GPU Upgrade (The High Priority)
The Quadro M4000 should be replaced with a modern card featuring **Tensor Cores**.
*   **Consumer Option:** NVIDIA **RTX 3060 (12GB)** - Best value for AI models.
*   **Professional Option:** NVIDIA **RTX A4000 (16GB)** - Peak stability for Dell Precision chassis.
*   **Benefit:** Reduces transcription latency from "Fast" to "Instant" (<100ms).

### 2. Infrastructure Best Practices
*   **Static IP Assignment:** Lock the server to `10.10.20.225` in the router so the Laptop configuration never breaks.
*   **Dockerization:** Move the Backend into a Docker container to eliminate Windows/Environment variable errors forever.
*   **Linux Transition:** For a true 24/7 production environment, move the server to **Ubuntu Server**. Linux CUDA drivers are 10-15% faster for Whisper inference than Windows.

---
**Status:** ✅ System Stable & Verified.  
**Last Updated:** 2026-01-19
