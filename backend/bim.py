"""Private IFC/GLB storage and versioned scheduling, native to Banyra."""
import json
import re
import struct
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import Field, model_validator

from .models import Model
from .bim_demo import building_ifc

MAX_MODEL = 50 * 1024 * 1024


class Element(Model):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=250)
    category: str = Field(min_length=1, max_length=100)


class Catalog(Model):
    elements: list[Element] = Field(min_length=1, max_length=20000)


class ScheduleInput(Model):
    title: str = Field(min_length=2, max_length=200)
    trade: str = Field(default="Gros œuvre", max_length=100)
    responsible: str = Field(default="", max_length=160)
    start_date: date
    end_date: date
    progress: int = Field(default=0, ge=0, le=100)
    model_id: str | None = None
    element_ids: list[str] = Field(default_factory=list, max_length=20000)
    predecessors: list[str] = Field(default_factory=list, max_length=50)
    notes: str = Field(default="", max_length=4000)

    @model_validator(mode="after")
    def dates(self):
        if self.end_date < self.start_date:
            raise ValueError("La fin précède le début")
        if self.element_ids and not self.model_id:
            raise ValueError("Choisissez une maquette pour lier des éléments")
        self.element_ids = list(dict.fromkeys(self.element_ids))
        self.predecessors = list(dict.fromkeys(self.predecessors))
        return self


class SchedulePatch(ScheduleInput):
    version: int = Field(ge=1)


def install_bim(app, *, user, db, access, uploads: Path, audit, uid, now):
    def reject(message, status=422):
        raise HTTPException(status, message)

    def model_record(connection, project_id, model_id):
        record = connection.execute("SELECT * FROM bim_models WHERE id=? AND project_id=?", (model_id, project_id)).fetchone()
        if not record:
            reject("Maquette introuvable sur ce chantier.", 404)
        return record

    def state(connection, project_id):
        models = []
        for row in connection.execute("SELECT * FROM bim_models WHERE project_id=? ORDER BY created_at DESC", (project_id,)):
            item = dict(row)
            item["catalog"] = json.loads(item["catalog"])
            models.append(item)
        schedule = []
        for row in connection.execute("SELECT * FROM schedule WHERE project_id=? ORDER BY start_date,title", (project_id,)):
            item = dict(row)
            item["element_ids"] = json.loads(item["element_ids"])
            item["predecessors"] = json.loads(item["predecessors"])
            schedule.append(item)
        return {"models": models, "schedule": schedule}

    @app.get("/api/projects/{project_id}/bim")
    def workspace(project_id: str, actor=Depends(user, scope="function"), connection=Depends(db, scope="function")):
        access(connection, project_id, actor)
        return state(connection, project_id)

    @app.post("/api/projects/{project_id}/bim/models", status_code=201)
    async def upload_model(project_id: str, file: UploadFile = File(), name: str = Form(""), actor=Depends(user, scope="function"), connection=Depends(db, scope="function")):
        access(connection, project_id, actor, write=True)
        content = await file.read(MAX_MODEL + 1)
        await file.close()
        if len(content) > MAX_MODEL:
            reject("Maquette trop volumineuse (50 Mo maximum).", 413)
        filename = (file.filename or "maquette").replace("\\", "/").split("/")[-1]
        filename = "".join(c for c in filename if ord(c) >= 32)[:180]
        fmt = filename.rsplit(".", 1)[-1].lower()
        if len(name) > 160:
            reject("Le nom de la maquette est trop long.")
        if fmt == "ifc":
            head = content[:32768].decode("utf-8", errors="ignore").upper()
            if not head.lstrip("\ufeff \r\n").startswith("ISO-10303-21;") or not re.search(r"FILE_SCHEMA\s*\(\s*\(\s*'IFC(?:2X3|4(?:X\d+)?)'", head):
                reject("Fichier IFC STEP attendu (IFC2x3 ou IFC4).")
        elif fmt == "glb":
            try:
                magic, version, length, chunk_length, chunk_type = struct.unpack("<4sIIII", content[:20])
                if magic != b"glTF" or version != 2 or length != len(content) or chunk_type != 0x4E4F534A:
                    raise ValueError()
                doc = json.loads(content[20:20 + chunk_length])
                if not isinstance(doc, dict) or not isinstance(doc.get("asset"), dict) or doc["asset"].get("version") != "2.0":
                    raise ValueError()
                resources = doc.get("buffers", []) + doc.get("images", [])
                if any(not isinstance(item, dict) for item in resources):
                    raise ValueError()
                if any("uri" in item for item in resources):
                    reject("Le GLB doit contenir ses ressources intégrées, sans URL externe.")
                if doc.get("extensionsRequired"):
                    reject("Exportez un GLB sans compression ni extension obligatoire.")
            except (ValueError, TypeError, struct.error, RecursionError):
                reject("Fichier GLB 2.0 invalide.")
        else:
            reject("Formats acceptés : IFC (.ifc) et glTF binaire (.glb).")
        model_id = uid()
        target = uploads / model_id
        try:
            target.write_bytes(content)
            connection.execute("INSERT INTO bim_models VALUES(?,?,?,?,?,?,?,?,?)", (model_id, project_id, name.strip() or filename, filename, fmt, len(content), "[]", actor["id"], now()))
            audit(connection, project_id, actor["id"], f"Maquette importée : {filename}")
        except BaseException:
            target.unlink(missing_ok=True)
            raise
        return {"id": model_id}

    @app.get("/api/projects/{project_id}/bim/models/{model_id}/file")
    def download(project_id: str, model_id: str, actor=Depends(user, scope="function"), connection=Depends(db, scope="function")):
        access(connection, project_id, actor)
        record = model_record(connection, project_id, model_id)
        if not (uploads / model_id).is_file():
            reject("Fichier de maquette introuvable.", 404)
        return FileResponse(uploads / model_id, media_type="application/octet-stream", filename=record["filename"])

    @app.post("/api/projects/{project_id}/bim/models/{model_id}/catalog")
    def catalog(project_id: str, model_id: str, data: Catalog, actor=Depends(user, scope="function"), connection=Depends(db, scope="function")):
        access(connection, project_id, actor, write=True)
        record = model_record(connection, project_id, model_id)
        ids = [item.id for item in data.elements]
        if len(set(ids)) != len(ids):
            reject("Identifiants d’éléments dupliqués.")
        # Immutable once indexed: scheduling retains stable IDs for this file.
        if not json.loads(record["catalog"]):
            connection.execute("UPDATE bim_models SET catalog=? WHERE id=? AND catalog='[]'", (json.dumps([e.model_dump() for e in data.elements]), model_id))
        return {"ok": True}

    def validate(connection, project_id, data, current=""):
        if data.model_id:
            model = model_record(connection, project_id, data.model_id)
            available = {e["id"] for e in json.loads(model["catalog"])}
            if set(data.element_ids) - available:
                reject("Certains éléments ne figurent pas dans cette maquette. Ouvrez-la pour terminer son indexation.")
        for predecessor in data.predecessors:
            row = connection.execute("SELECT * FROM schedule WHERE id=? AND project_id=?", (predecessor, project_id)).fetchone()
            if not row or predecessor == current:
                reject("Prédécesseur invalide pour cette tâche.")
            if row["end_date"] >= str(data.start_date):
                reject("La tâche doit démarrer après la fin de ses prédécesseurs.")
            seen, pending = set(), [predecessor]
            while pending:
                check = pending.pop()
                if check == current:
                    reject("Cette dépendance créerait une boucle dans le planning.")
                if check not in seen:
                    seen.add(check)
                    item = connection.execute("SELECT predecessors FROM schedule WHERE id=? AND project_id=?", (check, project_id)).fetchone()
                    if item:
                        pending.extend(json.loads(item["predecessors"]))
        if current:
            for row in connection.execute("SELECT * FROM schedule WHERE project_id=? AND id!=?", (project_id, current)):
                if current in json.loads(row["predecessors"]) and str(data.end_date) >= row["start_date"]:
                    reject("La fin empiète sur une tâche suivante. Décalez d’abord son démarrage.")

    @app.post("/api/projects/{project_id}/bim/schedule", status_code=201)
    def add_schedule(project_id: str, data: ScheduleInput, actor=Depends(user, scope="function"), connection=Depends(db, scope="function")):
        access(connection, project_id, actor, write=True)
        connection.execute("BEGIN IMMEDIATE")
        validate(connection, project_id, data)
        task_id = uid()
        connection.execute("INSERT INTO schedule VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)", (task_id, project_id, data.model_id, data.title, data.trade, data.responsible, str(data.start_date), str(data.end_date), data.progress, json.dumps(data.element_ids), json.dumps(data.predecessors), data.notes))
        audit(connection, project_id, actor["id"], f"Planning : {data.title}")
        return {"id": task_id}

    @app.put("/api/projects/{project_id}/bim/schedule/{task_id}")
    def edit_schedule(project_id: str, task_id: str, data: SchedulePatch, actor=Depends(user, scope="function"), connection=Depends(db, scope="function")):
        access(connection, project_id, actor, write=True)
        connection.execute("BEGIN IMMEDIATE")
        if not connection.execute("SELECT 1 FROM schedule WHERE id=? AND project_id=?", (task_id, project_id)).fetchone():
            reject("Tâche de planning introuvable.", 404)
        validate(connection, project_id, data, task_id)
        changed = connection.execute("""UPDATE schedule SET model_id=?,title=?,trade=?,responsible=?,start_date=?,end_date=?,progress=?,element_ids=?,predecessors=?,notes=?,version=version+1 WHERE id=? AND version=?""", (data.model_id, data.title, data.trade, data.responsible, str(data.start_date), str(data.end_date), data.progress, json.dumps(data.element_ids), json.dumps(data.predecessors), data.notes, task_id, data.version))
        if changed.rowcount != 1:
            reject("Cette tâche a été modifiée. Actualisez le planning.", 409)
        audit(connection, project_id, actor["id"], f"Planning modifié : {data.title}")
        return {"ok": True}

    @app.post("/api/projects/{project_id}/bim/demo", status_code=201)
    def demo(project_id: str, actor=Depends(user, scope="function"), connection=Depends(db, scope="function")):
        access(connection, project_id, actor, write=True)
        connection.execute("BEGIN IMMEDIATE")
        existing = connection.execute("SELECT id FROM bim_models WHERE project_id=? AND filename='banyra-demo.ifc'", (project_id,)).fetchone()
        if existing:
            return {"id": existing["id"]}
        model_id = uid()
        content, products = building_ifc()
        today = datetime.now(ZoneInfo("Africa/Casablanca")).date()
        labels = {"IFCSLAB": "Dalle", "IFCCOLUMN": "Poteau", "IFCWALL": "Voile"}
        catalog = [{"id": id_, "name": f"{labels[kind]} — niveau {level}", "category": kind} for id_, level, kind in products]
        target = uploads / model_id
        try:
            target.write_bytes(content)
            connection.execute("INSERT INTO bim_models VALUES(?,?,?,?,?,?,?,?,?)", (model_id, project_id, "Bâtiment exemple R+2 — IFC4", "banyra-demo.ifc", "ifc", len(content), json.dumps(catalog), actor["id"], now()))
            previous = []
            for level in range(3):
                tid = uid()
                connection.execute("INSERT INTO schedule VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)", (tid, project_id, model_id, f"Gros œuvre — niveau {level}", "Gros œuvre", actor["name"], str(today + timedelta(days=level * 14 - 14)), str(today + timedelta(days=level * 14 - 1)), [100, 35, 0][level], json.dumps([id_ for id_, lev, _ in products if lev == level]), json.dumps(previous), "Planning fictif pour découvrir la simulation 4D."))
                previous = [tid]
            audit(connection, project_id, actor["id"], "Maquette IFC et planning de démonstration créés")
        except BaseException:
            target.unlink(missing_ok=True)
            raise
        return {"id": model_id}
