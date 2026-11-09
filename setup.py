#!/usr/bin/env python3
"""Install the self-contained Banyra MVP, without external business software."""
import os
import subprocess
import sys
import venv
from pathlib import Path


def main():
    if sys.version_info < (3, 11):
        raise SystemExit("Python 3.11 ou plus récent est nécessaire.")
    root = Path(__file__).resolve().parent
    venv.create(root / ".venv", with_pip=True)
    python = root / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    subprocess.run([str(python), "-m", "pip", "install", "-r", "backend/requirements.lock"], cwd=root, check=True)
    subprocess.run(["npm", "ci", "--no-audit", "--no-fund"], cwd=root / "frontend", check=True)
    subprocess.run(["npm", "run", "build"], cwd=root / "frontend", check=True)
    print("Banyra est installé. Lancez : python3 run.py")


if __name__ == "__main__":
    main()
