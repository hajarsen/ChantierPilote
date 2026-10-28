import { test, expect } from '@playwright/test';

test('a site supervisor manages a project, quality check, journal, budget and purchase', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Explorer l’espace de démonstration' }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vos chantiers en un regard' })).toBeVisible();
  const name = `Banyra validation ${Date.now()}`;
  let projectId: string | undefined;
  try {
    await page.getByRole('button', { name: 'Nouveau chantier', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom du chantier').fill(name);
    await dialog.getByLabel('Ville', { exact: true }).fill('Rabat');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByLabel('Chantier', { exact: true }).selectOption({ label: name });
    projectId = await page.getByLabel('Chantier', { exact: true }).inputValue();

    await page.getByRole('link', { name: 'Contrôles qualité', exact: true }).click();
    await page.getByRole('button', { name: 'Nouveau contrôle', exact: true }).first().click();
    await dialog.getByLabel('Intitulé').fill('Contrôle du béton avant coulage');
    await dialog.getByLabel('Responsable terrain').fill('Responsable essais');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    const row = page.locator('.cp-task-row').filter({ hasText: 'Contrôle du béton avant coulage' });
    await expect(row).toBeVisible();
    await expect(row.getByRole('button', { name: 'Clôturer', exact: true })).toBeDisabled();
    await row.getByRole('button', { name: 'Contrôle du béton avant coulage', exact: true }).click();
    await expect(dialog.getByRole('checkbox')).toHaveCount(4);
    for (const checkbox of await dialog.getByRole('checkbox').all()) await checkbox.check();
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await row.getByRole('button', { name: 'Clôturer', exact: true }).click();
    await expect(row.getByRole('combobox')).toHaveValue('completed');

    await page.getByRole('link', { name: 'Journal de chantier', exact: true }).click();
    await page.getByRole('button', { name: 'Rédiger le journal', exact: true }).first().click();
    await dialog.getByLabel('Travaux réalisés et points de vigilance').fill('Ferraillage terminé. Contrôle avant coulage validé.');
    await dialog.getByLabel('Effectif présent').fill('18');
    await dialog.getByLabel('Engins mobilisés').fill('2');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('Ferraillage terminé. Contrôle avant coulage validé.', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Budget & coûts', exact: true }).click();
    await page.getByRole('button', { name: 'Définir l’enveloppe' }).click();
    await dialog.getByLabel('Montant de l’enveloppe').fill('1000000.50');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.cp-metric').filter({ hasText: 'Enveloppe du chantier' })).toContainText('1');

    await page.getByRole('link', { name: 'Achats & livraisons', exact: true }).click();
    await page.getByRole('button', { name: 'Préparer une commande', exact: true }).first().click();
    await dialog.getByLabel('Description', { exact: true }).first().fill('Béton de propreté');
    await dialog.getByLabel('Quantité', { exact: true }).fill('3');
    await dialog.getByLabel('Prix unitaire HT').fill('120.50');
    await dialog.getByLabel('TVA (%)', { exact: true }).fill('20');
    await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.cp-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.cp-table tbody')).toContainText('433,80');
    await expect(page.locator('.cp-table tbody')).toContainText('À préparer');

    // Verify the persisted decimal strings, not rounded display numbers.
    const saved = await page.evaluate(async (id) => {
      const token = sessionStorage.getItem('oe_access_token') || localStorage.getItem('oe_access_token');
      const headers = { Authorization: `Bearer ${token}` };
      const project = await fetch(`/api/v1/projects/${id}`, { headers }).then((r) => r.json());
      const orders = await fetch(`/api/v1/procurement/?project_id=${id}`, { headers }).then((r) => r.json());
      return { budget: project.budget_estimate, total: orders.items[0].amount_total, status: orders.items[0].status };
    }, projectId);
    expect(Number(saved.budget)).toBe(1000000.5);
    expect(Number(saved.total)).toBe(433.8);
    expect(saved.status).toBe('draft');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await page.getByRole('link', { name: 'Vue d’ensemble', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    if (projectId) await page.evaluate(async (id) => {
      const token = sessionStorage.getItem('oe_access_token') || localStorage.getItem('oe_access_token');
      await fetch(`/api/v1/projects/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    }, projectId);
  }
});
