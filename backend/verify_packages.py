#!/usr/bin/env python3
"""Verify all required packages are installed and importable."""

import sys

def verify_package(package_name, import_statement):
    """Verify a package can be imported."""
    try:
        exec(import_statement)
        print(f"[OK] {package_name}")
        return True
    except Exception as e:
        print(f"[FAIL] {package_name}: {e}")
        return False

def main():
    print(f"Python Version: {sys.version}\n")
    print("="*50)
    print("Verifying Packages")
    print("="*50)
    
    packages = [
        ("fastapi", "import fastapi"),
        ("uvicorn", "import uvicorn"),
        ("pydantic", "import pydantic"),
        ("python-dotenv", "import dotenv"),
        ("python-multipart", "import multipart"),
        ("livekit", "import livekit"),
        ("livekit-agents", "from livekit import agents"),
        ("livekit-api", "from livekit import api"),
        ("faster-whisper", "from faster_whisper import WhisperModel"),
        ("numpy", "import numpy"),
        ("webrtcvad-wheels", "import webrtcvad"),
        ("soundfile", "import soundfile"),
        ("aiohttp", "import aiohttp"),
        ("loguru", "from loguru import logger"),
        ("pydub", "from pydub import AudioSegment"),
        ("ffmpeg-python", "import ffmpeg"),
    ]
    
    success_count = 0
    for pkg_name, import_stmt in packages:
        if verify_package(pkg_name, import_stmt):
            success_count += 1
    
    print("="*50)
    print(f"\nResult: {success_count}/{len(packages)} packages verified successfully")
    
    if success_count == len(packages):
        print("\n[SUCCESS] ALL PACKAGES INSTALLED AND WORKING!")
        return 0
    else:
        print(f"\n[WARNING] {len(packages) - success_count} package(s) failed verification")
        return 1

if __name__ == "__main__":
    sys.exit(main())
