#!/usr/bin/env python3
"""Run the independent Banyra server with its compiled frontend."""
import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main():
    python = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.exists():
        raise SystemExit("Installez Banyra : python3 setup.py")
    if Path(sys.prefix).resolve() != (ROOT / ".venv").resolve():
        os.execv(str(python), [str(python), str(ROOT / "run.py"), *sys.argv[1:]])
    parser = argparse.ArgumentParser(description="Banyra — serveur local indépendant")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8010)
    parser.add_argument("--build", action="store_true", help="Recompiler l’interface après une mise à jour")
    args = parser.parse_args()
    os.chdir(ROOT)
    if args.build or not (ROOT / "frontend/dist/index.html").exists():
        subprocess.run(["npm", "run", "build"], cwd=ROOT / "frontend", check=True)
    import uvicorn

    print(f"Banyra : http://localhost:{args.port} — gardez ce terminal ouvert.", flush=True)
    uvicorn.run("backend.app:app", host=args.host, port=args.port, proxy_headers=True, forwarded_allow_ips="127.0.0.1")


if __name__ == "__main__":
    main()
