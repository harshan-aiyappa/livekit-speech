"""
Pre-download Whisper model for faster first-time usage
"""
from faster_whisper import WhisperModel

print("[DOWNLOAD] Downloading Whisper model (base)...")
print("           This is a one-time download of ~140MB")
print("           Model will be cached for future use\n")

# Download the model - same configuration as used in main.py
model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)

print("[SUCCESS] Model downloaded successfully!")
print("          Model is cached and ready to use")
print("\n[READY] Your app is ready to transcribe speech!")
