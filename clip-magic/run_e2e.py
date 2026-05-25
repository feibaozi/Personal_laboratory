import subprocess
import sys
import os

ROOT = r"C:\Users\hexi\Desktop\VScode\clip-magic"
VENV_DIR = os.path.join(ROOT, ".venv_e2e")
PYTHON_EXE = os.path.join(VENV_DIR, "Scripts", "python.exe")

PACKAGES = [
    "faster-whisper>=1.0.0",
    "openai>=1.0.0",
    "ffmpeg-python>=0.2.0",
    "yt-dlp>=2024.0.0",
    "pydantic>=2.0.0",
    "pydantic-settings>=2.0.0",
    "rich>=13.0.0",
    "click>=8.0.0",
    "imageio-ffmpeg>=0.5.0",
    "pillow>=10.0.0",
    "aiofiles>=0.8.0",
    "uvicorn[standard]>=0.24.0",
    "python-multipart>=0.0.6",
]

def run_cmd(cmd, check=True):
    print(f"  -> {cmd[:80]}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0 and check:
        print(f"  ERROR: {result.stderr[-300:]}")
        return False
    return True

def main():
    print("=" * 60)
    print("Clip Magic E2E Setup")
    print("=" * 60)

    if not os.path.exists(VENV_DIR):
        print(f"\n[1] Creating venv...")
        ok = run_cmd(sys.executable + " -m venv " + VENV_DIR)
        if not ok:
            print("FAIL: venv creation")
            return

    print("\n[2] Installing packages...")
    for pkg in PACKAGES:
        run_cmd(PYTHON_EXE + " -m pip install " + pkg, check=False)

    print("\n[3] Running e2e test...")
    env = os.environ.copy()
    env["PYTHONPATH"] = ROOT
    env["CLIP_MAGIC_WHISPER_DEVICE"] = "cuda"
    env["CLIP_MAGIC_WHISPER_COMPUTE_TYPE"] = "float16"
    env["CLIP_MAGIC_HIGHLIGHT_COUNT"] = "3"
    result = subprocess.run(
        [PYTHON_EXE, os.path.join(ROOT, "e2e_test.py")],
        env=env,
        capture_output=True,
        text=True,
    )
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr[-800:])
    print(f"\nE2E Exit code: {result.returncode}")

if __name__ == "__main__":
    main()
