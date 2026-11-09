"""Banyra: self-contained accounts, project collaboration and site operations."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from .database import connect, initialize
from .models import AcceptInvite, Credentials, ENTRY_MODELS, EntryInput, EntryPatch, Invitation, ProjectInput, Registration, TaskInput, TaskPatch

COOKIE = "banyra_session"
MAX_FILE = 10 * 1024 * 1024
MONEY_STEP = Decimal("0.01")


def uid() -> str:
    return uuid.uuid4().hex


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    result = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 600000).hex()
    return f"{salt}:{result}"


def verify_password(password: str, stored: str) -> bool:
    return hmac.compare_digest(password_hash(password, stored.split(":")[0]), stored)


def money(value: Decimal | str | int) -> str:
    return str(Decimal(value).quantize(MONEY_STEP, rounding=ROUND_HALF_UP))


def fail(code: int, message: str) -> None:
    raise HTTPException(code, message)


def public_user(row) -> dict:
    return {key: row[key] for key in ("id", "name", "email")}


def audit(db, project_id: str, user_id: str, description: str):
    db.execute("INSERT INTO events(project_id,user_id,description,created_at) VALUES(?,?,?,?)", (project_id, user_id, description, now()))


def task_json(row) -> dict:
    result = dict(row)
    result["checks"] = json.loads(result["checks"])
    return result


def entry_json(row) -> dict:
    result = dict(row)
    result["data"] = json.loads(result["data"])
    return result


def create_app(data_dir: Path | None = None, frontend_dir: Path | None = None, secure: bool | None = None) -> FastAPI:
    data_dir = data_dir or Path(os.environ.get("BANYRA_DATA_DIR", "data"))
    db_path = data_dir / "banyra.sqlite3"
    uploads = data_dir / "uploads"
    secure = (os.environ.get("BANYRA_SECURE_COOKIES", "0") == "1") if secure is None else secure
    public_origin = os.environ.get("BANYRA_PUBLIC_ORIGIN", "").rstrip("/")

    @asynccontextmanager
    async def lifespan(app):
        uploads.mkdir(parents=True, exist_ok=True)
        initialize(db_path)
        yield

    app = FastAPI(title="Banyra", version="1.0.0", lifespan=lifespan, docs_url=None, redoc_url=None)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return JSONResponse({"detail": "Vérifiez les champs : dates, montants et valeurs obligatoires."}, status_code=422)

    @app.middleware("http")
    async def security(request: Request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            expected = public_origin or str(request.base_url).rstrip("/")
            if request.headers.get("sec-fetch-site") == "cross-site" or (origin and origin != expected):
                return JSONResponse({"detail": "Origine de la requête refusée."}, status_code=403)
            try:
                if int(request.headers.get("content-length", "0")) > MAX_FILE + 100000:
                    return JSONResponse({"detail": "Fichier trop volumineux (10 Mo maximum)."}, status_code=413)
            except ValueError:
                return JSONResponse({"detail": "Requête invalide."}, status_code=400)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.url.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store"
        return response

    def db():
        connection = connect(db_path)
        try:
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    def user(request: Request, connection=Depends(db)):
        raw = request.cookies.get(COOKIE, "")
        session = connection.execute("SELECT s.*,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires>?", (digest(raw), int(time.time()))).fetchone()
        if not session:
            fail(401, "Connectez-vous pour continuer.")
        if request.method not in {"GET", "HEAD"} and not hmac.compare_digest(request.headers.get("x-csrf-token", ""), session["csrf"]):
            fail(403, "Session de formulaire invalide. Actualisez la page.")
        return {"id": session["user_id"], "name": session["name"], "email": session["email"], "csrf": session["csrf"]}

    def access(connection, project_id, actor, write=False, owner=False):
        member = connection.execute("SELECT role FROM members WHERE project_id=? AND user_id=?", (project_id, actor["id"])).fetchone()
        if not member:
            fail(404, "Chantier introuvable.")
        if (write and member["role"] == "viewer") or (owner and member["role"] != "owner"):
            fail(403, "Votre rôle ne permet pas cette modification.")
        return member["role"]

    def throttle(request: Request, label: str):
        key = digest(f"{label}:{request.client.host if request.client else 'local'}")
        stamp = int(time.time())
        # This separate transaction survives failed authentication responses.
        with connect(db_path) as connection:
            connection.execute("DELETE FROM attempts WHERE at<?", (stamp - 900,))
            count = connection.execute("SELECT COUNT(*) FROM attempts WHERE key=?", (key,)).fetchone()[0]
            if count >= 20:
                fail(429, "Trop de tentatives. Réessayez dans 15 minutes.")
            connection.execute("INSERT INTO attempts VALUES(?,?)", (key, stamp))

    def new_session(connection, response: Response, request: Request, account):
        connection.execute("DELETE FROM sessions WHERE token_hash=? OR expires<?", (digest(request.cookies.get(COOKIE, "")), int(time.time())))
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        connection.execute("INSERT INTO sessions VALUES(?,?,?,?)", (digest(token), account["id"], csrf, int(time.time()) + 7 * 86400))
        response.set_cookie(COOKIE, token, httponly=True, secure=secure, samesite="lax", max_age=7 * 86400, path="/")
        return {"user": public_user(account), "csrf": csrf}

    @app.get("/api/health")
    def health(connection=Depends(db)):
        connection.execute("SELECT 1")
        return {"status": "ok", "application": "Banyra"}

    @app.post("/api/auth/register", status_code=201)
    def register(data: Registration, request: Request, response: Response, connection=Depends(db)):
        throttle(request, "register")
        if os.environ.get("BANYRA_ALLOW_REGISTRATION", "1") != "1":
            fail(403, "Les inscriptions sont fermées. Contactez le responsable de votre chantier.")
        account = {"id": uid(), "name": data.name, "email": data.email}
        try:
            connection.execute("INSERT INTO users VALUES(?,?,?,?,?)", (account["id"], data.name, data.email, password_hash(data.password), now()))
        except sqlite3.IntegrityError:
            fail(409, "Cette adresse est déjà utilisée. Connectez-vous.")
        return new_session(connection, response, request, account)

    @app.post("/api/auth/login")
    def login(data: Credentials, request: Request, response: Response, connection=Depends(db)):
        throttle(request, "login")
        account = connection.execute("SELECT * FROM users WHERE email=?", (data.email,)).fetchone()
        # Constant-cost password work for unknown accounts too.
        stored = account["password"] if account else "0" * 32 + ":" + "0" * 64
        valid = verify_password(data.password, stored)
        if not account or not valid:
            fail(401, "Adresse e-mail ou mot de passe incorrect.")
        return new_session(connection, response, request, account)

    @app.get("/api/auth/session")
    def session(actor=Depends(user)):
        return {"user": {k: actor[k] for k in ("id", "name", "email")}, "csrf": actor["csrf"]}

    @app.post("/api/auth/logout")
    def logout(request: Request, response: Response, actor=Depends(user), connection=Depends(db)):
        connection.execute("DELETE FROM sessions WHERE token_hash=?", (digest(request.cookies.get(COOKIE, "")),))
        response.delete_cookie(COOKIE, path="/", secure=secure, httponly=True, samesite="lax")
        return {"ok": True}

    @app.get("/api/projects")
    def projects(actor=Depends(user), connection=Depends(db)):
        return [dict(row) for row in connection.execute("SELECT p.*,m.role FROM projects p JOIN members m ON p.id=m.project_id WHERE m.user_id=? ORDER BY p.created_at DESC", (actor["id"],))]

    @app.post("/api/projects", status_code=201)
    def create_project(data: ProjectInput, actor=Depends(user), connection=Depends(db)):
        project_id = uid()
        connection.execute("""INSERT INTO projects
            (id,name,reference,city,client,budget,vat,start_date,owner_id,created_at,end_date,address,province,project_type,area,architect,engineering_office,contractor,site_manager)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (project_id, data.name, data.reference, data.city, data.client, money(data.budget), str(data.vat), str(data.start_date), actor["id"], now(), str(data.end_date or ""), data.address, data.province, data.project_type, money(data.area), data.architect, data.engineering_office, data.contractor, data.site_manager))
        connection.execute("INSERT INTO members VALUES(?,?,?)", (project_id, actor["id"], "owner"))
        audit(connection, project_id, actor["id"], "Chantier créé")
        return {"id": project_id}

    @app.post("/api/demo", status_code=201)
    def create_demo(actor=Depends(user), connection=Depends(db)):
        """Create an explicitly labelled Moroccan sample workspace for evaluation."""
        project_id = uid()
        created = now()
        connection.execute("""INSERT INTO projects
            (id,name,reference,city,client,budget,vat,start_date,owner_id,created_at,end_date,address,province,project_type,area,architect,engineering_office,contractor,site_manager)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (project_id, "Résidence Al Manar — Démonstration", "MCH-2026-014", "Rabat", "Atlas Immobilier (donnée exemple)", "18500000.00", "0", "2026-09-01", actor["id"], created, "2028-02-29", "Avenue Annakhil, Hay Riad", "Rabat", "Logement", "12400.00", "Salma El Idrissi (exemple)", "BET Al Omrane Conseil (exemple)", "Bâtir Maroc (exemple)", actor["name"]))
        connection.execute("INSERT INTO members VALUES(?,?,?)", (project_id, actor["id"], "owner"))
        tasks = [
            ("Contrôler le ferraillage du voile V12", "quality", "Gros œuvre", "urgent", "2026-11-10"),
            ("Réserve d’étanchéité en terrasse bloc B", "reserve", "Étanchéité", "high", "2026-11-12"),
            ("Valider les attentes électriques du niveau R+2", "action", "Électricité", "normal", "2026-11-14"),
        ]
        demo_task_ids = []
        for title, kind, trade, priority, due in tasks:
            task_id = uid()
            demo_task_ids.append(task_id)
            checks = [{"label": item, "done": False} for item in ("Plan applicable vérifié", "Mise en œuvre contrôlée", "Photos et écarts consignés")] if kind == "quality" else []
            connection.execute("INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (task_id, project_id, title, "Donnée de démonstration à adapter au chantier réel.", kind, trade, actor["id"], due, "open", priority, json.dumps(checks), 1, actor["id"], created))
        samples = [
            ("diary", {"date": "2026-11-09", "workforce": 42, "weather": "Ensoleillé, vent faible", "temperature": "18–25 °C", "workforce_detail": "Bâtir Maroc : 18 ouvriers gros œuvre\nÉlec Atlas : 6 électriciens\nPlomb Maroc : 4 plombiers\nEncadrement et autres équipes : 14 personnes", "work_zones": "Bloc A R+2 · Bloc B terrasse", "notes": "Coulage de la dalle du bloc A terminé à 15 h 30. Pose des relevés d’étanchéité du bloc B en cours.", "equipment": "Grue à tour GT-01 · Pompe à béton · 2 nacelles", "deliveries": "72 m³ béton C30/37 — BL 4581 à 4587 — conforme", "quality": "Éprouvettes béton prélevées par le laboratoire. Ferraillage visé avant coulage.", "safety": "Causerie travail en hauteur. Garde-corps du bloc B remis en conformité.", "incidents": "Néant", "visitors": "Salma El Idrissi — architecte (exemple)", "decisions": "Reprendre deux réservations techniques avant le 11/11.", "blockers": "Livraison menuiserie aluminium décalée de 2 jours.", "next_day": "Décoffrage zone A2 · Réception étanchéité terrasse · Implantation cloisons R+1", "task_ids": demo_task_ids[:2]}),
            ("expense", {"title": "Location pompe à béton", "amount": "4800.00", "category": "Matériel", "supplier": "Loca BTP Maroc (exemple)", "date": "2026-11-09"}),
            ("contract", {"title": "Lot étanchéité", "partner": "Étanche Maroc (exemple)", "reference": "ST-ET-003", "amount": "780000.00", "retention": "10", "payment_days": 60}),
            ("supply", {"title": "Ciment CPJ 45", "supplier": "Matériaux du Centre (exemple)", "quantity": "120", "unit_price": "92.50", "delivery": "2026-11-13", "status": "draft", "amount": "11100.00"}),
            ("meeting", {"title": "Réunion hebdomadaire de chantier", "date": "2026-11-07", "participants": "Maître d’ouvrage, architecte, BET, entreprise", "notes": "Priorité à la levée des réserves du bloc B et à la préparation du planning à trois semaines."}),
        ]
        for kind, data in samples:
            connection.execute("INSERT INTO entries VALUES(?,?,?,?,?,?,?)", (uid(), project_id, kind, json.dumps(data), 1, actor["id"], created))
        audit(connection, project_id, actor["id"], "Chantier de démonstration marocain créé")
        return {"id": project_id}

    @app.put("/api/projects/{project_id}")
    def edit_project(project_id: str, data: ProjectInput, actor=Depends(user), connection=Depends(db)):
        access(connection, project_id, actor, owner=True)
        connection.execute("""UPDATE projects SET name=?,reference=?,city=?,client=?,budget=?,vat=?,start_date=?,end_date=?,address=?,province=?,project_type=?,area=?,architect=?,engineering_office=?,contractor=?,site_manager=? WHERE id=?""",
            (data.name, data.reference, data.city, data.client, money(data.budget), str(data.vat), str(data.start_date), str(data.end_date or ""), data.address, data.province, data.project_type, money(data.area), data.architect, data.engineering_office, data.contractor, data.site_manager, project_id))
        audit(connection, project_id, actor["id"], "Paramètres du chantier modifiés")
        return {"ok": True}

    @app.get("/api/projects/{project_id}/workspace")
    def workspace(project_id: str, actor=Depends(user), connection=Depends(db)):
        role = access(connection, project_id, actor)
        project = dict(connection.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
        project["role"] = role
        tasks = [task_json(row) for row in connection.execute("SELECT * FROM tasks WHERE project_id=? ORDER BY created_at DESC", (project_id,))]
        entries = [entry_json(row) for row in connection.execute("SELECT * FROM entries WHERE project_id=? ORDER BY created_at DESC", (project_id,))]
        spent = sum((Decimal(row["data"]["amount"]) for row in entries if row["kind"] == "expense"), Decimal(0))
        return {"project": project, "tasks": tasks, "entries": entries,
            "spent": money(spent), "remaining": money(Decimal(project["budget"]) - spent),
            "members": [dict(row) for row in connection.execute("SELECT u.id,u.name,u.email,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.project_id=? ORDER BY u.name", (project_id,))],
            "files": [dict(row) for row in connection.execute("SELECT * FROM files WHERE project_id=? ORDER BY created_at DESC", (project_id,))],
            "events": [dict(row) for row in connection.execute("SELECT e.description,e.created_at,u.name FROM events e JOIN users u ON u.id=e.user_id WHERE project_id=? ORDER BY e.id DESC LIMIT 25", (project_id,))]}

    def validate_task(connection, project_id, data, old=None):
        if data.assignee_id and not connection.execute("SELECT 1 FROM members WHERE project_id=? AND user_id=?", (project_id, data.assignee_id)).fetchone():
            fail(422, "Le responsable doit appartenir au chantier.")
        kind = old["kind"] if old else data.kind
        if old and old["kind"] != data.kind:
            fail(422, "Le type d’un contrôle ne peut pas être changé.")
        if data.status == "done" and kind in {"quality", "safety"} and (not data.checks or not all(item.done for item in data.checks)):
            fail(422, "Validez tous les points de contrôle avant la clôture.")

    @app.post("/api/projects/{project_id}/tasks", status_code=201)
    def create_task(project_id: str, data: TaskInput, actor=Depends(user), connection=Depends(db)):
        access(connection, project_id, actor, write=True)
        validate_task(connection, project_id, data)
        task_id = uid()
        connection.execute("INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (task_id, project_id, data.title, data.description, data.kind, data.trade, data.assignee_id, str(data.due_date or ""), data.status, data.priority, json.dumps([c.model_dump() for c in data.checks]), 1, actor["id"], now()))
        audit(connection, project_id, actor["id"], f"Action créée : {data.title}")
        return {"id": task_id}

    @app.put("/api/projects/{project_id}/tasks/{task_id}")
    def edit_task(project_id: str, task_id: str, data: TaskPatch, actor=Depends(user), connection=Depends(db)):
        access(connection, project_id, actor, write=True)
        old = connection.execute("SELECT * FROM tasks WHERE id=? AND project_id=?", (task_id, project_id)).fetchone()
        if not old:
            fail(404, "Action introuvable.")
        validate_task(connection, project_id, data, old)
        changed = connection.execute("UPDATE tasks SET title=?,description=?,trade=?,assignee_id=?,due_date=?,status=?,priority=?,checks=?,version=version+1 WHERE id=? AND version=?", (data.title, data.description, data.trade, data.assignee_id, str(data.due_date or ""), data.status, data.priority, json.dumps([c.model_dump() for c in data.checks]), task_id, data.version))
        if changed.rowcount != 1:
            fail(409, "Une autre personne a modifié cette action. Actualisez avant de réessayer.")
        audit(connection, project_id, actor["id"], f"Action modifiée : {data.title}")
        return {"ok": True}

    def validate_entry(connection, project_id, data, actor, old=None):
        if old and old["kind"] != data.kind:
            fail(422, "Le type de document ne peut pas être changé.")
        try:
            clean = ENTRY_MODELS[data.kind].model_validate(data.data).model_dump(mode="json")
        except ValidationError:
            fail(422, "Vérifiez les dates, montants et champs obligatoires du document.")
        if data.kind == "diary":
            if clean["task_ids"]:
                placeholders = ",".join("?" for _ in clean["task_ids"])
                found = connection.execute(f"SELECT COUNT(*) FROM tasks WHERE project_id=? AND id IN ({placeholders})", (project_id, *clean["task_ids"])).fetchone()[0]
                if found != len(set(clean["task_ids"])):
                    fail(422, "Une tâche liée n’appartient pas à ce chantier.")
            duplicate = connection.execute("SELECT id FROM entries WHERE project_id=? AND kind='diary' AND json_extract(data,'$.date')=? AND id!=?", (project_id, clean["date"], old["id"] if old else "")).fetchone()
            if duplicate:
                fail(409, "Un journal existe déjà pour cette journée. Ouvrez-le pour le modifier.")
        if data.kind == "supply":
            before = json.loads(old["data"]) if old else None
            if before and before["status"] in {"received", "cancelled"}:
                fail(409, "Cette commande est clôturée.")
            if not before and clean["status"] != "draft":
                fail(422, "Une commande commence en brouillon.")
            if before and before["status"] == "ordered" and clean["status"] not in {"ordered", "received", "cancelled"}:
                fail(422, "Une commande émise ne revient pas en brouillon.")
            clean["amount"] = money(Decimal(clean["quantity"]) * Decimal(clean["unit_price"]))
        if data.kind == "contract" and old:
            if connection.execute("SELECT 1 FROM entries WHERE project_id=? AND kind='valuation' AND json_extract(data,'$.contract_id')=?", (project_id, old["id"])).fetchone():
                fail(409, "Un marché ayant des situations ne peut plus être réécrit.")
        if data.kind == "valuation":
            contract = connection.execute("SELECT data FROM entries WHERE id=? AND project_id=? AND kind='contract'", (clean["contract_id"], project_id)).fetchone()
            if not contract:
                fail(422, "Marché introuvable sur ce chantier.")
            contract = json.loads(contract["data"])
            if not old and clean["status"] != "draft":
                fail(422, "Une situation commence en brouillon.")
            if old:
                before = json.loads(old["data"])
                if before["status"] == "paid":
                    fail(409, "Une situation réglée est clôturée.")
                if before["status"] == "approved" and any(clean[k] != before[k] for k in ("amount", "period", "contract_id")):
                    fail(409, "Une situation validée ne peut plus être réécrite.")
                if before["status"] == "approved" and clean["status"] != "paid":
                    fail(409, "La prochaine étape est le règlement.")
            if clean["status"] != "draft":
                access(connection, project_id, actor, owner=True)
            if clean["status"] == "paid" and (not old or json.loads(old["data"])["status"] != "approved"):
                fail(422, "Validez la situation avant le règlement.")
            others = connection.execute("SELECT id,data FROM entries WHERE project_id=? AND kind='valuation' AND json_extract(data,'$.contract_id')=? AND id!=?", (project_id, clean["contract_id"], old["id"] if old else "")).fetchall()
            if any(json.loads(row["data"])["period"] == clean["period"] for row in others):
                fail(409, "Une situation existe déjà pour ce mois et ce marché.")
            total = sum((Decimal(json.loads(row["data"])["amount"]) for row in others), Decimal(0)) + Decimal(clean["amount"])
            if total > Decimal(contract["amount"]):
                fail(422, "Le cumul des situations dépasse le montant du marché.")
            clean["retention_amount"] = money(Decimal(clean["amount"]) * Decimal(contract["retention"]) / 100)
            clean["net_amount"] = money(Decimal(clean["amount"]) - Decimal(clean["retention_amount"]))
        return clean

    @app.post("/api/projects/{project_id}/entries", status_code=201)
    def create_entry(project_id: str, data: EntryInput, actor=Depends(user), connection=Depends(db)):
        access(connection, project_id, actor, write=True)
        # Serialise read/validate/write, including cumulative valuation checks.
        connection.execute("BEGIN IMMEDIATE")
        clean = validate_entry(connection, project_id, data, actor)
        entry_id = uid()
        connection.execute("INSERT INTO entries VALUES(?,?,?,?,?,?,?)", (entry_id, project_id, data.kind, json.dumps(clean), 1, actor["id"], now()))
        audit(connection, project_id, actor["id"], {"diary": "Journal enregistré", "expense": "Dépense enregistrée", "contract": "Marché créé", "valuation": "Situation créée", "supply": "Commande créée", "meeting": "Compte rendu enregistré"}[data.kind])
        return {"id": entry_id}

    @app.put("/api/projects/{project_id}/entries/{entry_id}")
    def edit_entry(project_id: str, entry_id: str, data: EntryPatch, actor=Depends(user), connection=Depends(db)):
        access(connection, project_id, actor, write=True)
        connection.execute("BEGIN IMMEDIATE")
        old = connection.execute("SELECT * FROM entries WHERE id=? AND project_id=?", (entry_id, project_id)).fetchone()
        if not old:
            fail(404, "Document introuvable.")
        clean = validate_entry(connection, project_id, data, actor, old)
        changed = connection.execute("UPDATE entries SET data=?,version=version+1 WHERE id=? AND version=?", (json.dumps(clean), entry_id, data.version))
        if changed.rowcount != 1:
            fail(409, "Ce document a été modifié par une autre personne. Actualisez la page.")
        audit(connection, project_id, actor["id"], "Document modifié")
        return {"ok": True}

    @app.post("/api/projects/{project_id}/invitations", status_code=201)
    def invite(project_id: str, data: Invitation, actor=Depends(user), connection=Depends(db)):
        access(connection, project_id, actor, owner=True)
        token = secrets.token_urlsafe(32)
        invite_id = uid()
        connection.execute("INSERT INTO invitations VALUES(?,?,?,?,?,?,0)", (invite_id, digest(token), project_id, data.email, data.role, int(time.time()) + 7 * 86400))
        audit(connection, project_id, actor["id"], "Invitation créée")
        return {"path": f"/?invitation={token}", "expires_in_days": 7}

    @app.post("/api/invitations/accept")
    def accept(data: AcceptInvite, actor=Depends(user), connection=Depends(db)):
        connection.execute("BEGIN IMMEDIATE")
        invitation = connection.execute("SELECT * FROM invitations WHERE token_hash=? AND used=0 AND expires>?", (digest(data.token), int(time.time()))).fetchone()
        if not invitation:
            fail(404, "Cette invitation est expirée ou a déjà été utilisée.")
        if invitation["email"] != actor["email"]:
            fail(403, "Connectez-vous avec l’adresse e-mail destinataire de l’invitation.")
        connection.execute("INSERT INTO members VALUES(?,?,?) ON CONFLICT(project_id,user_id) DO NOTHING", (invitation["project_id"], actor["id"], invitation["role"]))
        connection.execute("UPDATE invitations SET used=1 WHERE id=?", (invitation["id"],))
        audit(connection, invitation["project_id"], actor["id"], "Un membre a rejoint le chantier")
        return {"project_id": invitation["project_id"]}

    @app.delete("/api/projects/{project_id}/members/{member_id}")
    def remove_member(project_id: str, member_id: str, actor=Depends(user), connection=Depends(db)):
        access(connection, project_id, actor, owner=True)
        if member_id == actor["id"]:
            fail(422, "Le propriétaire ne peut pas se retirer du chantier.")
        connection.execute("DELETE FROM members WHERE project_id=? AND user_id=?", (project_id, member_id))
        # Previously shared invitation links must not restore revoked access.
        connection.execute("UPDATE invitations SET used=1 WHERE project_id=? AND email=(SELECT email FROM users WHERE id=?)", (project_id, member_id))
        audit(connection, project_id, actor["id"], "Accès d’un membre retiré")
        return {"ok": True}

    @app.post("/api/projects/{project_id}/files", status_code=201)
    async def upload(project_id: str, file: UploadFile = File(), label: str = Form(""), revision: str = Form("A"), task_id: str = Form(""), entry_id: str = Form(""), actor=Depends(user), connection=Depends(db)):
        access(connection, project_id, actor, write=True)
        if task_id and not connection.execute("SELECT 1 FROM tasks WHERE id=? AND project_id=?", (task_id, project_id)).fetchone():
            fail(422, "Action introuvable sur ce chantier.")
        if entry_id and not connection.execute("SELECT 1 FROM entries WHERE id=? AND project_id=? AND kind='diary'", (entry_id, project_id)).fetchone():
            fail(422, "Journal introuvable sur ce chantier.")
        content = await file.read(MAX_FILE + 1)
        await file.close()
        if len(content) > MAX_FILE:
            fail(413, "Fichier trop volumineux (10 Mo maximum).")
        mime = "application/pdf" if content.startswith(b"%PDF-") else "image/png" if content.startswith(b"\x89PNG\r\n\x1a\n") else "image/jpeg" if content.startswith(b"\xff\xd8\xff") else None
        if not mime:
            fail(422, "Formats acceptés : PDF, JPEG et PNG.")
        name = (file.filename or "document").replace("\\", "/").split("/")[-1][:200]
        name = "".join(c for c in name if ord(c) >= 32) or "document"
        if len(label) > 200 or len(revision) > 30:
            fail(422, "Libellé ou révision trop long.")
        file_id = uid()
        target = uploads / file_id
        try:
            target.write_bytes(content)
            connection.execute("""INSERT INTO files
                (id,project_id,task_id,name,label,revision,mime,size,created_by,created_at,entry_id)
                VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                (file_id, project_id, task_id or None, name, label or name, revision, mime, len(content), actor["id"], now(), entry_id or None))
            audit(connection, project_id, actor["id"], f"Document ajouté : {name}")
        except BaseException:
            target.unlink(missing_ok=True)
            raise
        return {"id": file_id}

    @app.get("/api/projects/{project_id}/files/{file_id}")
    def download(project_id: str, file_id: str, actor=Depends(user), connection=Depends(db)):
        access(connection, project_id, actor)
        record = connection.execute("SELECT * FROM files WHERE id=? AND project_id=?", (file_id, project_id)).fetchone()
        if not record or not (uploads / record["id"]).is_file():
            fail(404, "Fichier introuvable.")
        return FileResponse(uploads / record["id"], media_type=record["mime"], filename=record["name"], content_disposition_type="inline")

    # Production serves the compiled Banyra frontend from this same server.
    frontend_dir = frontend_dir or Path(__file__).resolve().parents[1] / "frontend" / "dist"
    if frontend_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=frontend_dir / "assets"), name="assets")

        @app.get("/{path:path}")
        def index(path: str):
            if path == "api" or path.startswith("api/"):
                fail(404, "Route inconnue.")
            if path == "third-party.txt":
                return FileResponse(frontend_dir / "third-party.txt", media_type="text/plain")
            return FileResponse(frontend_dir / "index.html", headers={"Cache-Control": "no-cache"})

    return app


app = create_app()
