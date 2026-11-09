import { test, expect, type Page } from "@playwright/test";

const stamp = () => `${Date.now()}${Math.random().toString(16).slice(2, 7)}`;
async function register(page: Page, email = `hajar-${stamp()}@example.ma`) {
  await page.goto("/register");
  await page.getByLabel("Nom complet", { exact: true }).fill("Hajar Amrani");
  await page.getByLabel("Adresse e-mail", { exact: true }).fill(email);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("Banyra-Test-2026");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(
    page.getByRole("button", { name: "Nouveau chantier", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Vos chantiers en un regard" }),
  ).toBeVisible();
  return email;
}
async function createProject(page: Page) {
  await page
    .getByRole("button", { name: "Nouveau chantier", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nom du chantier", { exact: true })
    .fill("Résidence Les Oliviers");
  await dialog.getByLabel("Ville", { exact: true }).fill("Casablanca");
  await dialog
    .getByLabel("Enveloppe budgétaire HT (MAD)", { exact: true })
    .fill("1000000");
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByLabel("Chantier", { exact: true }).locator("option:checked"),
  ).toHaveText("Résidence Les Oliviers");
  await expect(
    page.getByRole("heading", { name: "Les prochaines étapes" }),
  ).toBeVisible();
}
const nav = (page: Page, name: string) =>
  page
    .locator(".sidebar nav")
    .getByRole("button", { name, exact: true })
    .click();

test("Moroccan portfolio opens populated, persists and uses the Banyra visual identity", async ({
  page,
}) => {
  await register(page);
  await expect(page.locator(".project-card")).toHaveCount(3);
  await expect(page.locator(".demo-banner")).toContainText("DÉMONSTRATION");
  await expect(
    page.locator(".project-card").filter({ hasText: "Rabat" }),
  ).toContainText(/18[.\s]500[.\s]000,00/);
  await expect(page.locator(".hero-photo img")).toBeVisible();
  expect(
    await page
      .locator(".hero-photo img")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
  expect(
    await page
      .locator(".brand")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Plus Jakarta Sans");
  await page.screenshot({
    path: "test-results/banyra-populated-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await nav(page, "Budget & coûts");
  await expect(
    page.getByText("Béton prêt à l’emploi C30/37", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".metrics.three")).toContainText(/341[.\s]400,00/);
  await page.reload();
  await expect(page.locator(".project-card")).toHaveCount(3);
  await nav(page, "Équipe du chantier");
  await expect(
    page.getByText("Salma El Idrissi", { exact: true }),
  ).toBeVisible();
  await nav(page, "Sécurité");
  await page
    .getByRole("button", { name: "Signaler un risque", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Type de suivi"),
  ).toHaveValue("safety");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await nav(page, "Vue d’ensemble");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/banyra-populated-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("a delayed response from a signed-out account cannot populate the next account", async ({
  page,
}) => {
  await register(page);
  await createProject(page);
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  let delay = true;
  await page.route("**/api/projects", async (route) => {
    if (route.request().method() === "GET" && delay) {
      delay = false;
      const response = await route.fetch();
      started();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Actualiser", exact: true }).click();
  await requested;
  await page.locator(".account-button").click();
  await page
    .getByRole("button", { name: "Créer un compte", exact: true })
    .click();
  await page.getByLabel("Nom complet", { exact: true }).fill("Nouveau compte");
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .fill(`second-${stamp()}@example.ma`);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("Banyra-Test-2026");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(
    page.getByRole("heading", { name: "Vos chantiers en un regard" }),
  ).toBeVisible();
  const responseReceived = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/projects") &&
      response.request().method() === "GET",
  );
  release();
  await responseReceived;
  await expect(
    page.getByLabel("Chantier", { exact: true }).getByRole("option"),
  ).toHaveCount(4);
  await expect(
    page.getByText("Résidence Les Oliviers", { exact: true }),
  ).toHaveCount(0);
});

test("independent account, project, reserve with photo and quality closure persist", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await register(page);
  await createProject(page);
  await nav(page, "Actions terrain");
  await page
    .getByRole("button", { name: "Nouvelle action", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Type de suivi").selectOption("reserve");
  await dialog
    .getByLabel("Intitulé", { exact: true })
    .fill("Fissure à reprendre dans le hall");
  await dialog
    .getByLabel("Description", { exact: true })
    .fill("Reprise de finition avant réception du lot.");
  await dialog
    .getByLabel("Responsable", { exact: true })
    .selectOption({ label: "Hajar Amrani" });
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: /Fissure à reprendre/ }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Ajouter une photo ou un PDF (10 Mo maximum)")
    .setInputFiles({
      name: "reserve.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNioAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(dialog.getByRole("link", { name: "reserve.png" })).toBeVisible();
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await page.reload();
  await nav(page, "Actions terrain");
  await expect(
    page.getByRole("button", { name: /Fissure à reprendre/ }),
  ).toBeVisible();
  await nav(page, "Contrôles qualité");
  await page
    .getByRole("button", { name: "Nouveau contrôle", exact: true })
    .click();
  await page
    .getByLabel("Intitulé", { exact: true })
    .fill("Contrôle du ferraillage");
  await expect(
    page.getByRole("option", { name: "Terminé", exact: true }),
  ).toBeDisabled();
  for (const checkbox of await page
    .getByRole("dialog")
    .getByRole("checkbox")
    .all())
    await checkbox.check();
  await page.getByLabel("Statut", { exact: true }).selectOption("done");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(
    page
      .locator(".task-row")
      .filter({ hasText: "Contrôle du ferraillage" })
      .getByText("Terminé", { exact: true }),
  ).toBeVisible();
  await nav(page, "Vue d’ensemble");
  await page.screenshot({
    path: "test-results/banyra-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("journal, budget, market and purchasing run through the own API", async ({
  page,
}) => {
  await register(page);
  await createProject(page);
  await nav(page, "Journal de chantier");
  await page
    .getByRole("button", { name: "Rédiger le journal", exact: true })
    .click();
  await page
    .getByLabel("Travaux réalisés et points de vigilance")
    .fill("Bétonnage terminé. Protéger les accès au niveau 1.");
  await page.getByLabel("Effectif présent").fill("18");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(
    page.getByText("Bétonnage terminé. Protéger les accès au niveau 1.", {
      exact: true,
    }),
  ).toBeVisible();
  await nav(page, "Budget & coûts");
  await page.getByRole("button", { name: "Ajouter une dépense" }).click();
  await page.getByLabel("Désignation", { exact: true }).fill("Béton B25");
  await page.getByLabel("Montant HT (MAD)", { exact: true }).fill("12500.50");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(page.getByText("Béton B25", { exact: true })).toBeVisible();
  await nav(page, "Marchés & situations");
  await page
    .getByRole("button", { name: "Nouveau marché", exact: true })
    .click();
  await page.getByLabel("Objet du marché").fill("Lot gros œuvre");
  await page.getByLabel("Entreprise / sous-traitant").fill("Entreprise Atlas");
  await page.getByLabel("Montant du marché HT (MAD)").fill("200000");
  await page.getByLabel("Retenue contractuelle (%)").fill("7");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await page.getByRole("button", { name: "Créer une situation" }).click();
  await page.getByLabel("Travaux de la période HT (MAD)").fill("20000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await page
    .getByRole("button", { name: "Marquer réglée", exact: true })
    .click();
  await expect(page.getByText("Réglée", { exact: true })).toBeVisible();
  await nav(page, "Achats & livraisons");
  await page.getByRole("button", { name: "Préparer une commande" }).click();
  await page.getByLabel("Désignation des fournitures").fill("Parpaings");
  await page
    .getByLabel("Fournisseur", { exact: true })
    .fill("Fournisseur Atlas");
  await page.getByLabel("Quantité", { exact: true }).fill("500");
  await page.getByLabel("Prix unitaire HT (MAD)").fill("8");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await page.getByRole("button", { name: "Réceptionner", exact: true }).click();
  await expect(page.getByText("Réceptionné", { exact: true })).toBeVisible();
});

test("a second account joins only by invitation and viewer role prevents changes", async ({
  page,
  browser,
}) => {
  await register(page);
  await createProject(page);
  await nav(page, "Équipe du chantier");
  await page.getByRole("button", { name: "Inviter une personne" }).click();
  const email = `member-${stamp()}@example.ma`;
  await page.getByLabel("Adresse e-mail du destinataire").fill(email);
  await page.getByLabel("Rôle sur le chantier").selectOption("viewer");
  await page
    .getByRole("button", { name: "Créer le lien d’invitation" })
    .click();
  const link = await page
    .getByLabel("Lien d’invitation à partager")
    .inputValue();
  const context = await browser.newContext();
  try {
    const second = await context.newPage();
    await register(second, email);
    await expect(
      second.getByRole("heading", {
        name: "Vos chantiers en un regard",
      }),
    ).toBeVisible();
    await second.goto(link);
    await second.getByRole("button", { name: "Rejoindre le chantier" }).click();
    await expect(
      second.getByRole("heading", { name: "Les prochaines étapes" }),
    ).toBeVisible();
    await nav(second, "Actions terrain");
    await expect(
      second.getByRole("button", { name: "Nouvelle action", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Fermer", exact: true })
      .click();
    await page.getByRole("button", { name: "Actualiser", exact: true }).click();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("mobile account pages and workspace stay inside Banyra without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  await createProject(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await nav(page, "Plans & documents");
  await expect(
    page.getByRole("heading", { name: "Plans & documents", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("OpenConstructionERP", { exact: false }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/banyra-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
