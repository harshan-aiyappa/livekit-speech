
# Whisper Model Guide & System Requirements

This document outlines the available Speech-to-Text models, their hardware requirements, and recommendations for CPU-only vs GPU setups.

## 1. Available Models (Faster-Whisper)

Faster-Whisper is an optimized implementation of OpenAI's Whisper.

| Model Size   | Parameters | Disk Size | RAM (Int8) | CPU Speed    | Accuracy   | Recommended Use Case                |
| :----------- | :--------- | :-------- | :--------- | :----------- | :--------- | :---------------------------------- |
| **tiny**     | 39 M       | 75 MB     | ~100 MB    | ⚡ Ultra Fast | Low        | Debugging, Keyword detection        |
| **base**     | 74 M       | 145 MB    | ~200 MB    | 🚀 Very Fast  | Medium     | Simple dictations, Clear audio      |
| **small**    | 244 M      | 480 MB    | ~600 MB    | 🏃 Fast       | **High**   | **Best for Real-time CPU (No GPU)** |
| **medium**   | 769 M      | 1.5 GB    | ~2 GB      | 🐢 Slow       | Very High  | GPU Required for Real-time          |
| **large-v3** | 1550 M     | 3.0 GB    | ~4 GB      | 🐌 Very Slow  | Ultra High | Offline / GPU Server                |

---

## 2. Hardware Recommendations

### 🟢 Scenario A: No NVIDIA GPU (CPU Only)
*   **Recommended Model:** `small` (int8 quantization)
*   **Why:** This is the "Goldilocks" model. It offers significantly better accuracy than `base` (understanding names, accents) while executing in **under 500ms** on most modern CPUs (Intel i5/i7/M1).
*   **Trade-off:** If you switch to `medium`, latency jumps to >2 seconds, killing the real-time feel.

### 🚀 Scenario B: NVIDIA GPU (RTX 3060 / 4090 etc.)
*   **Recommended Model:** `large-v3` or `medium` (float16)
*   **Why:** GPUs act as parallel accelerators. A basic RTX 3060 can run `large-v3` faster than a CPU runs `tiny`.
*   **Setup:** requires installing `torch` with CUDA support and `cuDNN`.

---

## 3. Current Configuration (Optimized for Your Logic)

We have configured `backend/main.py` with the following optimal settings for your CPU setup:

1.  **Model:** `small`
    *   *Reason:* Best accuracy without lag.
2.  **Compute Type:** `int8`
    *   *Reason:* Reduces memory usage by 50% and increases speed by 2x compared to float32.
3.  **VAD (Voice Activity Detection):** `True`
    *   *Reason:* Prevents processing silence, saving CPU cycles.
4.  **Anti-Hallucination Filter:** Active
    *   *Reason:* Blocks common Whisper errors ("Thank you", "Amara.org") which happen often with smaller models.

## 4. Troubleshooting Accuracy
*   **Hallucinations:** If you see "Thank you" loops, ensure the room is quiet. Background TV/Music confuses the model.
*   **Latency:** If the TAT (Turnaround Time) exceeds 1.5s, consider downgrading to `base` in `main.py`.

