#!/usr/bin/env python3
"""Start the local Banyra workspace independently of an interactive tool session.

This is a development launcher, not a public hosting service. Only the exact
processes recorded by this launcher may be stopped by it. PostgreSQL is managed
by the application's own CLI, and its persistent data is never removed here.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / ".venv" / "banyra-services.json"
LOGS = ROOT / ".venv" / "banyra-logs"
DATA = Path(os.environ.get("BANYRA_DATA_DIR", str(ROOT.parent / "openconstructionerp-data")))
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def identity(pid: int) -> str | None:
    """Return Linux process start ticks, or None for a dead/unreadable process."""
    try:
        fields = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
        return fields[19] if fields[0] != "Z" else None
    except (OSError, IndexError):
        return None


def read_state() -> dict:
    try:
        return json.loads(STATE.read_text())
    except (OSError, ValueError):
        return {}


def live(record: dict) -> bool:
    return bool(record.get("started")) and identity(record["pid"]) == record["started"]


def healthy(port: int) -> bool:
    try:
        with HTTP.open(f"http://127.0.0.1:{port}/api/health", timeout=3) as response:
            data = json.load(response)
            return data.get("status") == "healthy" and data.get("database") == "ok"
    except (OSError, ValueError, urllib.error.URLError):
        return False


def service_environments() -> tuple[dict[str, str], dict[str, str], str]:
    """Allow only this Codespace's forwarded hostname, retaining Vite checks."""
    backend_env = os.environ.copy()
    frontend_env = os.environ.copy()
    origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    name = os.environ.get("CODESPACE_NAME", "")
    frontend_host = "127.0.0.1"
    if name:
        domain = os.environ.get("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev")
        preview_host = f"{name}-5173.{domain}"
        frontend_env["__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS"] = preview_host
        if f"https://{preview_host}" not in origins.split(","):
            origins += f",https://{preview_host}"
        frontend_host = "0.0.0.0"
    backend_env.update({
        "OE_DATA_DIR": str(DATA), "OE_DISABLE_UPDATE_CHECK": "1",
        "OE_DOWNLOAD_EMBEDDING_MODEL": "0", "REDIS_URL": "",
        "ALLOWED_ORIGINS": origins,
    })
    return backend_env, frontend_env, frontend_host


def launch() -> None:
    if not (ROOT / ".venv" / "bin" / "openconstructionerp").is_file():
        raise SystemExit("Install backend dependencies in .venv first.")
    if not (ROOT / "frontend" / "node_modules" / "vite").is_dir():
        raise SystemExit("Run npm ci in frontend first.")
    LOGS.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    state = read_state()
    backend_env, frontend_env, frontend_host = service_environments()
    services = {
        "backend": (8000, ROOT / "backend", backend_env, [str(ROOT / ".venv" / "bin" / "openconstructionerp"),
            "serve", "--host", "127.0.0.1", "--port", "8000", "--data-dir", str(DATA), "--demo"]),
        "frontend": (5173, ROOT / "frontend", frontend_env, ["npm", "run", "dev", "--",
            "--host", frontend_host, "--port", "5173", "--strictPort"]),
    }
    for name, (port, cwd, env, command) in services.items():
        if live(state.get(name, {})):
            print(f"{name}: already started by this launcher", flush=True)
            continue
        if healthy(port):
            print(f"{name}: healthy existing service reused", flush=True)
            continue
        # A new session and detached standard streams keep the application
        # independent of the shell that invoked this short-lived launcher.
        with (LOGS / f"{name}.log").open("ab") as stream:
            process = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        state[name] = {"pid": process.pid, "started": identity(process.pid)}
        temporary = STATE.with_suffix(".tmp")
        temporary.write_text(json.dumps(state, indent=2) + "\n")
        temporary.replace(STATE)
        print(f"{name}: started; log: {LOGS / (name + '.log')}", flush=True)


def stop() -> None:
    for name, record in read_state().items():
        if live(record):
            os.killpg(record["pid"], signal.SIGTERM)
            print(f"{name}: shutdown requested")
    # Retain identities so another stop/start can distinguish an exiting
    # process from one that is gone. Never delete the application's data.


def status() -> int:
    checks = {"backend": healthy(8000), "frontend": healthy(5173)}
    for name, ready in checks.items():
        print(f"{name}: {'healthy' if ready else 'not ready'}", flush=True)
    return 0 if all(checks.values()) else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["start", "stop", "status"])
    parser.add_argument("--wait", type=int, default=0, help="Maximum startup readiness wait, in seconds")
    args = parser.parse_args()
    if args.command == "stop":
        stop()
        return 0
    if args.command == "start":
        launch()
        if not args.wait:
            return 0
    deadline = time.monotonic() + args.wait
    while True:
        if healthy(8000) and healthy(5173):
            return status()
        if time.monotonic() >= deadline:
            return status()
        time.sleep(2)


if __name__ == "__main__":
    sys.exit(main())
