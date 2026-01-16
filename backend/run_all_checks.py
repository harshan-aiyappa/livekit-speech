"""
Run all verification checks in sequence
"""
import subprocess
import sys

def run_script(script_name, description):
    """Run a verification script and report results."""
    print("\n" + "=" * 60)
    print(f"  {description}")
    print("=" * 60)
    
    try:
        result = subprocess.run(
            [sys.executable, script_name],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        print(result.stdout)
        
        if result.stderr:
            print(result.stderr)
        
        return result.returncode == 0
    except Exception as e:
        print(f"Error running {script_name}: {e}")
        return False

def main():
    """Run all verification scripts."""
    print("\n" + "🔍 " * 20)
    print("  COMPREHENSIVE BACKEND VERIFICATION")
    print("🔍 " * 20)
    
    scripts = [
        ("verify_packages.py", "Checking Package Installation"),
        ("verify_model.py", "Checking Model Availability"),
        ("download_model.py", "Verifying Model Download"),
    ]
    
    results = []
    for script, desc in scripts:
        success = run_script(script, desc)
        results.append((desc, success))
    
    # Summary
    print("\n" + "=" * 60)
    print("  VERIFICATION SUMMARY")
    print("=" * 60)
    
    for desc, success in results:
        status = "✅ PASSED" if success else "⚠️  WARNING"
        print(f"{status}: {desc}")
    
    all_passed = all(r[1] for r in results)
    
    print("\n" + "=" * 60)
    if all_passed:
        print("  ✅ ALL CHECKS PASSED - BACKEND IS READY!")
    else:
        print("  ⚠️  SOME CHECKS HAD WARNINGS - REVIEW ABOVE")
    print("=" * 60 + "\n")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
