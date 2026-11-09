import base64
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app


@pytest.fixture
def clients(tmp_path):
    app = create_app(tmp_path, frontend_dir=tmp_path / "no-interface", secure=False)
    with TestClient(app) as owner, TestClient(app) as other, TestClient(app) as viewer:
        yield owner, other, viewer


def register(client, email="hajar@example.ma"):
    response = client.post("/api/auth/register", json={"name": "Hajar Amrani", "email": email, "password": "Banyra-Test-2026"})
    assert response.status_code == 201, response.text
    client.headers["X-CSRF-Token"] = response.json()["csrf"]
    return response.json()["user"]


def project(client):
    response = client.post("/api/projects", json={"name": "Résidence du Parc", "city": "Rabat", "budget": "1000000.00"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def add_entry(client, pid, kind, data):
    return client.post(f"/api/projects/{pid}/entries", json={"kind": kind, "data": data})


def workspace(client, pid):
    response = client.get(f"/api/projects/{pid}/workspace")
    assert response.status_code == 200, response.text
    return response.json()


def invite(owner, other, pid, email, role="member"):
    response = owner.post(f"/api/projects/{pid}/invitations", json={"email": email, "role": role})
    assert response.status_code == 201, response.text
    token = response.json()["path"].split("invitation=")[1]
    accepted = other.post("/api/invitations/accept", json={"token": token})
    assert accepted.status_code == 200, accepted.text
    return token


def test_registration_login_csrf_and_logout(clients):
    owner, other, _ = clients
    assert owner.get("/api/auth/session").status_code == 401
    register(owner)
    assert owner.cookies.get("banyra_session")
    assert owner.get("/api/auth/session").json()["user"]["email"] == "hajar@example.ma"
    assert owner.post("/api/projects", json={"name": "Test"}, headers={"X-CSRF-Token": "wrong"}).status_code == 403
    assert other.post("/api/auth/login", json={"email": "hajar@example.ma", "password": "incorrect"}).status_code == 401
    login = other.post("/api/auth/login", json={"email": "hajar@example.ma", "password": "Banyra-Test-2026"})
    assert login.status_code == 200
    assert "httponly" in login.headers["set-cookie"].lower()
    assert owner.post("/api/auth/logout").status_code == 200
    assert owner.get("/api/projects").status_code == 401


@pytest.mark.parametrize("values", [
    {"email": "invalid", "password": "StrongPass-2026"},
    {"email": "a@example.ma", "password": "short1"},
    {"email": "a@example.ma", "password": "abcdefghijklmnop"},
])
def test_registration_validation(clients, values):
    assert clients[0].post("/api/auth/register", json={"name": "Hajar", **values}).status_code == 422


def test_cross_origin_write_is_refused(clients):
    owner = clients[0]
    register(owner)
    assert owner.post("/api/projects", json={"name": "Résidence"}, headers={"Origin": "https://unknown.example"}).status_code == 403


def test_private_projects_are_not_visible_to_other_accounts(clients):
    owner, other, _ = clients
    register(owner)
    register(other, "other@example.ma")
    pid = project(owner)
    assert other.get("/api/projects").json() == []
    assert other.get(f"/api/projects/{pid}/workspace").status_code == 404
    assert other.post(f"/api/projects/{pid}/tasks", json={"title": "Interdit"}).status_code == 404
    assert other.put(f"/api/projects/{pid}", json={"name": "Interdit"}).status_code == 404


def test_invitations_bind_email_and_are_single_use(clients):
    owner, other, viewer = clients
    register(owner)
    register(other, "member@example.ma")
    register(viewer, "wrong@example.ma")
    pid = project(owner)
    result = owner.post(f"/api/projects/{pid}/invitations", json={"email": "member@example.ma", "role": "member"}).json()
    token = result["path"].split("invitation=")[1]
    assert viewer.post("/api/invitations/accept", json={"token": token}).status_code == 403
    assert other.post("/api/invitations/accept", json={"token": token}).status_code == 200
    assert other.post("/api/invitations/accept", json={"token": token}).status_code == 404
    assert workspace(other, pid)["project"]["role"] == "member"
    assert other.post(f"/api/projects/{pid}/invitations", json={"email": "a@example.ma", "role": "member"}).status_code == 403


def test_viewer_cannot_write_and_revocation_takes_effect(clients):
    owner, other, _ = clients
    register(owner)
    account = register(other, "viewer@example.ma")
    pid = project(owner)
    invite(owner, other, pid, "viewer@example.ma", "viewer")
    assert workspace(other, pid)["project"]["role"] == "viewer"
    assert other.post(f"/api/projects/{pid}/tasks", json={"title": "Interdit"}).status_code == 403
    assert add_entry(other, pid, "expense", {"title": "Interdit", "amount": "10", "date": "2026-11-09"}).status_code == 403
    assert owner.delete(f"/api/projects/{pid}/members/{account['id']}").status_code == 200
    assert other.get(f"/api/projects/{pid}/workspace").status_code == 404


def test_task_checklist_closure_and_optimistic_concurrency(clients):
    owner = clients[0]
    register(owner)
    pid = project(owner)
    payload = {"title": "Contrôle du ferraillage", "kind": "quality", "checks": [{"label": "Plan validé", "done": False}]}
    assert owner.post(f"/api/projects/{pid}/tasks", json={**payload, "status": "done"}).status_code == 422
    task_id = owner.post(f"/api/projects/{pid}/tasks", json=payload).json()["id"]
    url = f"/api/projects/{pid}/tasks/{task_id}"
    assert owner.put(url, json={**payload, "kind": "action", "status": "done", "version": 1}).status_code == 422
    assert owner.put(url, json={**payload, "status": "done", "version": 1}).status_code == 422
    payload["checks"][0]["done"] = True
    assert owner.put(url, json={**payload, "status": "done", "version": 1}).status_code == 200
    assert owner.put(url, json={**payload, "status": "open", "version": 1}).status_code == 409
    task = workspace(owner, pid)["tasks"][0]
    assert task["status"] == "done" and task["version"] == 2


def test_task_assignment_is_scoped_to_project_members(clients):
    owner, other, _ = clients
    register(owner)
    account = register(other, "outside@example.ma")
    pid = project(owner)
    assert owner.post(f"/api/projects/{pid}/tasks", json={"title": "Action", "assignee_id": account["id"]}).status_code == 422


def test_diary_is_unique_per_day_and_persists(clients):
    owner = clients[0]
    register(owner)
    pid = project(owner)
    data = {"date": "2026-11-09", "notes": "Coulage du plancher terminé.", "workforce": 12}
    assert add_entry(owner, pid, "diary", data).status_code == 201
    assert add_entry(owner, pid, "diary", data).status_code == 409
    assert workspace(owner, pid)["entries"][0]["data"]["notes"] == data["notes"]


def test_budget_uses_decimal_amounts_and_authoritative_totals(clients):
    owner = clients[0]
    register(owner)
    pid = project(owner)
    for amount in ["0.10", "0.20"]:
        assert add_entry(owner, pid, "expense", {"title": "Matériaux", "date": "2026-11-09", "amount": amount}).status_code == 201
    data = workspace(owner, pid)
    assert data["spent"] == "0.30"
    assert data["remaining"] == "999999.70"
    assert add_entry(owner, pid, "expense", {"title": "Erreur", "date": "2026-11-09", "amount": "-10"}).status_code == 422


def test_contract_valuations_enforce_ceiling_and_state_changes(clients):
    owner, member, _ = clients
    register(owner)
    register(member, "member@example.ma")
    pid = project(owner)
    invite(owner, member, pid, "member@example.ma")
    contract = add_entry(owner, pid, "contract", {"title": "Gros œuvre", "partner": "Entreprise Atlas", "amount": "1000", "retention": "7"}).json()["id"]
    data = {"contract_id": contract, "period": "2026-11", "amount": "500"}
    vid = add_entry(member, pid, "valuation", data).json()["id"]
    assert add_entry(owner, pid, "valuation", {**data, "period": "2026-12", "amount": "501"}).status_code == 422
    assert add_entry(owner, pid, "valuation", data).status_code == 409
    url = f"/api/projects/{pid}/entries/{vid}"
    update = {"kind": "valuation", "data": {**data, "status": "approved"}, "version": 1}
    assert member.put(url, json=update).status_code == 403
    assert owner.put(url, json={**update, "data": {**data, "status": "paid"}}).status_code == 422
    assert owner.put(url, json=update).status_code == 200
    assert owner.put(url, json={**update, "version": 2, "data": {**data, "amount": "600", "status": "paid"}}).status_code == 409
    assert owner.put(url, json={**update, "version": 2, "data": {**data, "status": "paid"}}).status_code == 200
    valuation = next(e for e in workspace(owner, pid)["entries"] if e["id"] == vid)
    assert Decimal(valuation["data"]["net_amount"]) == Decimal("465")


def test_supplies_are_computed_and_received_orders_are_closed(clients):
    owner = clients[0]
    register(owner)
    pid = project(owner)
    data = {"title": "Briques", "supplier": "Fournisseur Atlas", "quantity": "3", "unit_price": "11.11", "delivery": "2026-11-10"}
    eid = add_entry(owner, pid, "supply", data).json()["id"]
    assert workspace(owner, pid)["entries"][0]["data"]["amount"] == "33.33"
    url = f"/api/projects/{pid}/entries/{eid}"
    for version, status in [(1, "ordered"), (2, "received")]:
        assert owner.put(url, json={"kind": "supply", "version": version, "data": {**data, "status": status}}).status_code == 200
    assert owner.put(url, json={"kind": "supply", "version": 3, "data": {**data, "status": "draft"}}).status_code == 409


def test_attachments_are_private_and_cross_project_linking_is_rejected(clients):
    owner, other, _ = clients
    register(owner)
    register(other, "outsider@example.ma")
    pid = project(owner)
    tid = owner.post(f"/api/projects/{pid}/tasks", json={"title": "Réserve mur", "kind": "reserve"}).json()["id"]
    png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNioAAAAASUVORK5CYII=")
    created = owner.post(f"/api/projects/{pid}/files", data={"task_id": tid}, files={"file": ("preuve.png", png, "image/png")})
    assert created.status_code == 201, created.text
    url = f"/api/projects/{pid}/files/{created.json()['id']}"
    assert owner.get(url).content == png
    assert other.get(url).status_code == 404
    assert owner.post(f"/api/projects/{pid}/files", files={"file": ("script.png", b"<script>alert(1)</script>", "image/png")}).status_code == 422
    second = project(owner)
    assert owner.post(f"/api/projects/{second}/files", data={"task_id": tid}, files={"file": ("preuve.png", png, "image/png")}).status_code == 422


def test_frontend_and_library_notices_are_served_without_exposing_unknown_api(tmp_path):
    web = tmp_path / "web"
    (web / "assets").mkdir(parents=True)
    (web / "index.html").write_text("<!doctype html><title>Banyra</title>")
    (web / "third-party.txt").write_text("Banyra — notices des bibliothèques")
    with TestClient(create_app(tmp_path / "database", frontend_dir=web)) as client:
        assert "Banyra" in client.get("/register").text
        notice = client.get("/third-party.txt")
        assert notice.status_code == 200
        assert notice.headers["content-type"].startswith("text/plain")
        assert client.get("/api/unknown").status_code == 404
