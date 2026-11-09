import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Exercise the actual deployment CSP: Emscripten bindings require JS and WASM evaluation.
const csp = readFileSync(
  new URL("../../deploy/Caddyfile", import.meta.url),
  "utf8",
).match(/Content-Security-Policy "([^"]+)"/)![1];
test.beforeEach(async ({ page }) => {
  await page.route("http://127.0.0.1:8011/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": csp },
    });
  });
});

function triangleGlb() {
  const binary = Buffer.alloc(44);
  [0, 0, 0, 2, 0, 0, 0, 0, 2].forEach((value, index) =>
    binary.writeFloatLE(value, index * 4),
  );
  [0, 1, 2].forEach((value, index) =>
    binary.writeUInt16LE(value, 36 + index * 2),
  );
  const json = JSON.stringify({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "Dalle GLB" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: 44 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [2, 0, 2],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
    ],
  });
  const payload = Buffer.from(json + " ".repeat((4 - (json.length % 4)) % 4));
  const header = Buffer.alloc(20);
  header.write("glTF");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + payload.length + binary.length, 8);
  header.writeUInt32LE(payload.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, payload, binHeader, binary]);
}

test("GLB upload is parsed, indexed and persists as a separate model", async ({
  page,
}) => {
  const response = await page.request.post("/api/auth/register", {
    data: {
      name: "Youssef Bennani",
      email: `glb-${Date.now()}@example.ma`,
      password: "Banyra-Test-2026",
    },
  });
  expect(response.status()).toBe(201);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Vos chantiers en un regard" }),
  ).toBeVisible();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Maquette BIM · 3D", exact: true })
    .click();
  await page.getByLabel("Fichier IFC ou GLB", { exact: true }).setInputFiles({
    name: "dalle.glb",
    mimeType: "model/gltf-binary",
    buffer: triangleGlb(),
  });
  await page
    .getByLabel("Nom de la maquette", { exact: true })
    .fill("Dalle importée GLB");
  await page.getByRole("button", { name: "Importer", exact: true }).click();
  await expect(page.getByLabel("Vue 3D de la maquette")).toHaveAttribute(
    "data-element-count",
    "1",
    { timeout: 45000 },
  );
  await page.getByRole("checkbox", { name: /Sélectionner Dalle/ }).check();
  await expect(page.locator(".bim-properties")).toContainText("GLB");
  await page.getByRole("button", { name: "Lier au planning" }).click();
  await expect(
    page.getByRole("dialog").getByText("Éléments 3D liés (1)"),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer", exact: true })
    .click();
  const selected = await page.getByLabel("Maquette du chantier").inputValue();
  await page.getByRole("button", { name: "Actualiser le planning" }).click();
  await expect(page.getByLabel("Maquette du chantier")).toHaveValue(selected);
  await expect(
    page.getByLabel("Maquette du chantier").getByRole("option"),
  ).toHaveCount(2);
});

test("real IFC geometry, selection, 4D and persistent planning work inside Banyra", async ({
  page,
}) => {
  const dateAt = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const registration = await page.request.post("/api/auth/register", {
    data: {
      name: "Hajar Amrani",
      email: `bim-${Date.now()}@example.ma`,
      password: "Banyra-Test-2026",
    },
  });
  expect(registration.status()).toBe(201);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Vos chantiers en un regard" }),
  ).toBeVisible();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Maquette BIM · 3D", exact: true })
    .click();
  await page.getByRole("button", { name: "Maquette exemple R+2" }).click();
  const canvas = page.getByLabel("Vue 3D de la maquette");
  await expect(canvas).toHaveAttribute("data-element-count", "30", {
    timeout: 45000,
  });
  await expect(page.locator(".bim-stage-message")).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Sélectionner Dalle niveau 0", exact: true })
    .check();
  await expect(page.locator(".bim-properties")).toContainText("GlobalId");
  await expect(page.locator(".bim-properties")).toContainText("Dalle niveau 0");
  await page.getByRole("button", { name: "Lier au planning" }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Intitulé de la tâche")
    .fill("Réception de la dalle RDC");
  await dialog.getByLabel("Début prévu").fill(dateAt(3));
  await dialog.getByLabel("Fin prévue").fill(dateAt(4));
  await dialog.getByLabel("Avancement réel (%)", { exact: true }).fill("20");
  await dialog.getByRole("button", { name: "Enregistrer la tâche" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.locator(".gantt-row").filter({ hasText: "Réception de la dalle RDC" }),
  ).toContainText("20 % réel · 1 élément");
  await page
    .getByRole("checkbox", { name: "Simulation 4D du planning", exact: true })
    .check();
  await page
    .getByLabel("Date de simulation 4D", { exact: true })
    .fill(dateAt(3));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page
    .getByRole("button", { name: "Désélectionner", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/banyra-bim-4d.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Planning · 4D", exact: true })
    .click();
  await page
    .locator(".gantt-row")
    .filter({ hasText: "Réception de la dalle RDC" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Avancement réel (%)", { exact: true }).fill("60");
  await dialog.getByRole("button", { name: "Enregistrer la tâche" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vos chantiers en un regard" }),
  ).toBeVisible();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Planning · 4D", exact: true })
    .click();
  await expect(
    page.locator(".gantt-row").filter({ hasText: "Réception de la dalle RDC" }),
  ).toContainText("60 % réel · 1 élément");
  await expect(canvas).toHaveAttribute("data-element-count", "30", {
    timeout: 45000,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/banyra-bim-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
