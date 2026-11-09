"""The independent Banyra schema. Monetary amounts use decimal strings or cents."""
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
INSERT OR IGNORE INTO schema_version VALUES (1);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (key TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS attempts_by_key ON attempts(key, at);
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, reference TEXT NOT NULL, city TEXT NOT NULL,
 client TEXT NOT NULL, budget TEXT NOT NULL, vat TEXT NOT NULL, start_date TEXT NOT NULL,
 owner_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
 project_id TEXT NOT NULL REFERENCES projects(id), user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('owner','member','viewer')), PRIMARY KEY(project_id,user_id)
);
CREATE TABLE IF NOT EXISTS invitations (
 id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id),
 email TEXT NOT NULL, role TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL,
 description TEXT NOT NULL, kind TEXT NOT NULL, trade TEXT NOT NULL, assignee_id TEXT REFERENCES users(id),
 due_date TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, checks TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entries (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), kind TEXT NOT NULL,
 data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS entries_by_project ON entries(project_id,kind);
CREATE TABLE IF NOT EXISTS files (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), task_id TEXT REFERENCES tasks(id),
 name TEXT NOT NULL, label TEXT NOT NULL, revision TEXT NOT NULL, mime TEXT NOT NULL,
 size INTEGER NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL REFERENCES projects(id),
 user_id TEXT NOT NULL REFERENCES users(id), description TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_setups (
 user_id TEXT PRIMARY KEY REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
 name TEXT NOT NULL, role TEXT NOT NULL, company TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bim_models (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
 name TEXT NOT NULL, filename TEXT NOT NULL, format TEXT NOT NULL,
 size INTEGER NOT NULL, catalog TEXT NOT NULL DEFAULT '[]',
 created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS models_by_project ON bim_models(project_id);
CREATE TABLE IF NOT EXISTS schedule (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
 model_id TEXT REFERENCES bim_models(id), title TEXT NOT NULL, trade TEXT NOT NULL,
 responsible TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
 progress INTEGER NOT NULL, element_ids TEXT NOT NULL, predecessors TEXT NOT NULL,
 notes TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS schedule_by_project ON schedule(project_id);
"""


def connect(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path, timeout=10, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA busy_timeout=10000")
    return connection


def initialize(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript(SCHEMA)
        # Additive migrations preserve databases created by earlier Banyra versions.
        project_columns = {
            "end_date": "TEXT NOT NULL DEFAULT ''",
            "address": "TEXT NOT NULL DEFAULT ''",
            "province": "TEXT NOT NULL DEFAULT ''",
            "project_type": "TEXT NOT NULL DEFAULT 'Logement'",
            "area": "TEXT NOT NULL DEFAULT '0.00'",
            "architect": "TEXT NOT NULL DEFAULT ''",
            "engineering_office": "TEXT NOT NULL DEFAULT ''",
            "contractor": "TEXT NOT NULL DEFAULT ''",
            "site_manager": "TEXT NOT NULL DEFAULT ''",
            "is_demo": "INTEGER NOT NULL DEFAULT 0",
        }
        existing = {row[1] for row in db.execute("PRAGMA table_info(projects)")}
        for name, definition in project_columns.items():
            if name not in existing:
                db.execute(f"ALTER TABLE projects ADD COLUMN {name} {definition}")
        file_columns = {row[1] for row in db.execute("PRAGMA table_info(files)")}
        if "entry_id" not in file_columns:
            db.execute("ALTER TABLE files ADD COLUMN entry_id TEXT REFERENCES entries(id)")
