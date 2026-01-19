# 🎛️ System Configuration Guide
### Switching between Harshan's PC and Office Server

The application is designed to be highly portable. You can switch between low-power local development and high-power server deployment by simply toggling blocks in your `backend/.env` file.

---

## 1. System Presets

### **Preset A: Harshan's PC (Local Development)**
*   **Use Case:** Debugging, UI changes, quick testing.
*   **Hardware:** Laptop CPU.
*   **Model:** `small` or `tiny`.
*   **Logic:** Uses Cloud LiveKit for easy mobile testing.

### **Preset B: Office Server (Production / Xeon Gold)**
*   **Target Hardware:** Dell Precision 7820 Tower.
*   **Processor:** Intel Xeon Gold 6130 (16 Cores / 32 Threads) | 128GB RAM.
*   **Advantage:** Supports **AVX-512** instructions. With 128GB RAM, you can run the `large-v3` model with peak performance and zero memory pressure.
*   **Model:** `large-v3` (Highest accuracy).
*   **Logic:** Uses Local or Private LiveKit Instance for maximum privacy.

---

## 2. Hardware Comparison

| Hardware           | Preset Name       | Model Size | Device | Intel Optimization         |
| :----------------- | :---------------- | :--------- | :----- | :------------------------- |
| **Xeon Gold 6130** | **Office Server** | `large-v3` | `cpu`  | ✅ **AVX-512** (Powerhouse) |
| **i7 / Ryzen 7**   | **Harshan's PC**  | `small`    | `cpu`  | ✅ AVX2                     |
| **Old Laptop**     | **Emergency**     | `tiny`     | `cpu`  | ⚠️ SSE4                     |

---

## 3. How to Switch
1.  Open `backend/.env`.
2.  Comment out the old block using `#`.
3.  Uncomment the new block.
4.  Restart the backend: `python main.py`.

---

## 4. Verification Logs
Check your terminal output on startup:

```bash
# Success: Office Server Mode
INFO:asr-worker:⏳ Loading Whisper (large-v3) model on cuda...
INFO:asr-worker:🤖 [LIFESPAN] Starting LiveKit Agent...

# Success: Harshan's PC Mode
INFO:asr-worker:⏳ Loading Whisper (small) model on cpu...
```
