"""
Pre-download Whisper model for faster first-time usage
"""
from faster_whisper import WhisperModel

print("🔽 Downloading Whisper model (base)...")
print("   This is a one-time download of ~140MB")
print("   Model will be cached for future use\n")

# Download the model - same configuration as used in main.py
model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)

print("✅ Model downloaded successfully!")
print(f"   Model cached at: {model.model_path}")
print("\n🎉 Your app is ready to transcribe speech!")
