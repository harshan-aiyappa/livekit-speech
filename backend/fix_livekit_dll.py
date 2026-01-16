"""
LiveKit DLL Path Workaround for Windows
This script adds the livekit_ffi.dll path to the system DLL search directories
"""
import os
import sys

def setup_livekit_dll_path():
    """Add livekit DLL directory to the Windows DLL search path."""
    if os.name != 'nt':  # Only needed on Windows
        return True
    
    # Find the DLL path in the virtual environment
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        # We're in a virtual environment
        venv_path = sys.prefix
    else:
        venv_path = os.path.dirname(sys.executable)
    
    dll_path = os.path.join(venv_path, 'Lib', 'site-packages', 'livekit', 'rtc', 'resources')
    
    if not os.path.exists(dll_path):
        print(f"[WARNING] DLL path not found: {dll_path}")
        return False
    
    try:
        # Python 3.8+ on Windows requires explicit DLL directory registration
        if hasattr(os, 'add_dll_directory'):
            os.add_dll_directory(dll_path)
            print(f"[OK] Added DLL directory: {dll_path}")
            return True
        else:
            print("[WARNING] os.add_dll_directory not available (Python < 3.8)")
            return False
    except OSError as e:
        print(f"[ERROR] Failed to add DLL directory: {e}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("  LiveKit DLL Path Setup")
    print("="*60)
    
    if setup_livekit_dll_path():
        print("\n[SUCCESS] DLL path configured successfully")
        
        # Try importing livekit.agents
        try:
            print("\nTesting livekit.agents import...")
            from livekit import agents
            print("[SUCCESS] livekit.agents imported successfully!")
        except Exception as e:
            print(f"[FAIL] Still cannot import livekit.agents: {e}")
            print("\nYou may need to:")
            print("1. Install Microsoft Visual C++ Redistributable")
            print("2. Try: pip install livekit==1.0.20 livekit-agents==1.2.15")
    else:
        print("\n[FAIL] Could not configure DLL path")
