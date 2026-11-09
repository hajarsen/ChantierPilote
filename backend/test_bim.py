"""BIM access, file validation, persistent scheduling and dependency rules."""
import json
import struct

from backend.test_app import clients, invite, project, register
from backend.bim_demo import building_ifc


def state(client, pid):
    result = client.get(f"/api/projects/{pid}/bim")
    assert result.status_code == 200, result.text
    return result.json()


def test_bim_demo_file_is_private_and_idempotent(clients):
    owner, other, _ = clients
    register(owner)
    register(other, "outside@example.ma")
    pid = project(owner)
    created = owner.post(f"/api/projects/{pid}/bim/demo")
    assert created.status_code == 201, created.text
    mid = created.json()["id"]
    assert owner.post(f"/api/projects/{pid}/bim/demo").json()["id"] == mid
    data = state(owner, pid)
    assert len(data["models"]) == 1
    assert len(data["models"][0]["catalog"]) == 30
    assert len(data["schedule"]) == 3
    assert sum(len(t["element_ids"]) for t in data["schedule"]) == 30
    path = f"/api/projects/{pid}/bim/models/{mid}/file"
    download = owner.get(path)
    assert download.content.startswith(b"ISO-10303-21;")
    assert b"IFC4" in download.content
    assert other.get(path).status_code == 404
    assert other.get(f"/api/projects/{pid}/bim").status_code == 404


def test_bim_upload_and_indexing_require_membership_and_valid_files(clients):
    owner, viewer, _ = clients
    register(owner)
    register(viewer, "viewer@example.ma")
    pid = project(owner)
    invite(owner, viewer, pid, "viewer@example.ma", "viewer")
    path = f"/api/projects/{pid}/bim/models"
    source, products = building_ifc()
    assert viewer.post(path, files={"file": ("test.ifc", source)}).status_code == 403
    assert owner.post(path, files={"file": ("fake.ifc", b"<script>alert(1)</script>")}).status_code == 422
    response = owner.post(path, files={"file": ("structure.ifc", source)})
    assert response.status_code == 201, response.text
    mid = response.json()["id"]
    catalog = {"elements": [{"id": products[0][0], "name": "Dalle RDC", "category": "IFCSLAB"}]}
    index = f"{path}/{mid}/catalog"
    assert viewer.post(index, json=catalog).status_code == 403
    assert owner.post(index, json=catalog).status_code == 200
    assert owner.post(index, json={"elements": catalog["elements"] * 2}).status_code == 422
    assert len(state(owner, pid)["models"][0]["catalog"]) == 1
    second = project(owner)
    assert owner.post(f"/api/projects/{second}/bim/models/{mid}/catalog", json=catalog).status_code == 404


def glb(doc):
    payload = json.dumps(doc).encode()
    payload += b" " * (-len(payload) % 4)
    return struct.pack("<4sIIII", b"glTF", 2, len(payload) + 20, len(payload), 0x4E4F534A) + payload


def test_glb_rejects_external_resources_and_corrupt_headers(clients):
    owner = clients[0]
    register(owner)
    pid = project(owner)
    path = f"/api/projects/{pid}/bim/models"
    assert owner.post(path, files={"file": ("valid.glb", glb({"asset": {"version": "2.0"}, "scenes": []}))}).status_code == 201
    assert owner.post(path, files={"file": ("broken.glb", b"glTFbad")}).status_code == 422
    assert owner.post(path, files={"file": ("external.glb", glb({"buffers": [{"uri": "https://example.test/file.bin"}]}))}).status_code == 422


def test_schedule_links_dates_dependencies_versions_and_read_only(clients):
    owner, viewer, _ = clients
    register(owner)
    register(viewer, "viewer@example.ma")
    pid = project(owner)
    invite(owner, viewer, pid, "viewer@example.ma", "viewer")
    mid = owner.post(f"/api/projects/{pid}/bim/demo").json()["id"]
    data = state(owner, pid)
    element = data["models"][0]["catalog"][0]["id"]
    path = f"/api/projects/{pid}/bim/schedule"
    body = {"title": "Pose des menuiseries", "start_date": "2030-01-01", "end_date": "2030-01-05", "model_id": mid, "element_ids": [element], "progress": 25}
    assert viewer.post(path, json=body).status_code == 403
    assert owner.post(path, json={**body, "end_date": "2029-12-01"}).status_code == 422
    assert owner.post(path, json={**body, "element_ids": ["unknown"]}).status_code == 422
    response = owner.post(path, json=body)
    assert response.status_code == 201, response.text
    tid = response.json()["id"]
    assert owner.put(f"{path}/{tid}", json={**body, "progress": 50, "version": 1}).status_code == 200
    assert owner.put(f"{path}/{tid}", json={**body, "progress": 80, "version": 1}).status_code == 409
    next_body = {"title": "Réception menuiseries", "start_date": "2030-01-05", "end_date": "2030-01-07", "predecessors": [tid]}
    assert owner.post(path, json=next_body).status_code == 422
    next_body["start_date"] = "2030-01-06"
    next_id = owner.post(path, json=next_body).json()["id"]
    assert owner.put(f"{path}/{tid}", json={**body, "version": 2, "end_date": "2030-01-08"}).status_code == 422
    assert owner.put(f"{path}/{tid}", json={**body, "version": 2, "predecessors": [next_id]}).status_code == 422
    other = project(owner)
    assert owner.post(f"/api/projects/{other}/bim/schedule", json=body).status_code == 404
    assert owner.put(f"/api/projects/{other}/bim/schedule/{tid}", json={**body, "version": 2}).status_code == 404
    persisted = next(t for t in state(owner, pid)["schedule"] if t["id"] == tid)
    assert persisted["progress"] == 50 and persisted["element_ids"] == [element]
