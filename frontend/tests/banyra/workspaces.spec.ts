import { test, expect, type Page } from '@playwright/test';

async function openDemo(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Explorer l’espace de démonstration' }).click();
  await expect(page.locator('.cp-page-heading h1')).toHaveText('Vue d’ensemble');
  const projectId = await page.getByLabel('Chantier', { exact: true }).getByRole('option', { name: 'Maison individuelle — projet de référence', exact: true }).getAttribute('value');
  if (!projectId) throw new Error('A demo project is required');
  return projectId;
}

test('six tools stay in Banyra and retain the selected project', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const projectId = await openDemo(page);
  await page.getByLabel('Chantier', { exact: true }).selectOption('');
  await page.goto('/pilot/plans');
  await expect(page.getByRole('heading', { name: 'Sélectionnez un chantier' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Espace métier du chantier' })).toHaveCount(0);
  await page.getByLabel('Chantier', { exact: true }).selectOption(projectId);
  const modules = [
    ['plans', 'Plans & documents'], ['reserves', 'Réserves & photos'],
    ['planning', 'Planning & avancement'], ['estimates', 'Devis & métrés'],
    ['model', 'Maquette 3D'], ['coordination', 'Liaisons 4D / 5D'],
  ];
  for (const [id, label] of modules) {
    await page.locator('.cp-sidebar nav').getByRole('link', { name: label!, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/pilot/${id}/${projectId}${id === 'model' ? '(?:/[^/?]+)?' : ''}$`));
    await expect(page.locator('.cp-page-heading h1')).toHaveText(label!);
    await expect(page.getByRole('region', { name: 'Espace métier du chantier' })).toBeVisible();
    await expect(page.getByLabel('Chantier', { exact: true })).toHaveValue(projectId);
    const content = page.locator('.cp-erp-workspace');
    if (id === 'plans' || id === 'model') await expect(content.locator('canvas').first()).toBeVisible();
    if (id === 'reserves') await expect(content.locator('tbody tr').first()).toBeVisible();
    if (id === 'planning') await expect(content.getByText('Programme - Residential House - Reference Build', { exact: true })).toBeVisible();
    if (id === 'estimates') await expect(content.getByText('Construction Estimate', { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Analyse des coûts 5D', exact: true }).click();
  await expect(page.getByText(/budget total/i).first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Chantier', { exact: true })).toHaveValue(projectId);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('documents and estimate editing keep the Banyra shell', async ({ page }) => {
  const projectId = await openDemo(page);
  await page.goto(`/pilot/plans/${projectId}`);
  await page.getByRole('button', { name: 'Documents et révisions', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/pilot/plans/${projectId}/files$`));
  await expect(page.locator('.cp-sidebar')).toBeVisible();
  await page.goto(`/pilot/estimates/${projectId}`);
  await page.locator('.cp-erp-workspace').getByText('Construction Estimate', { exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/pilot/estimates/${projectId}/edit/[^/]+$`));
  await expect(page.locator('.cp-sidebar')).toBeVisible();
});

test('a Banyra session creates a reserve and uploads photo evidence', async ({ page }) => {
  const projectId = await openDemo(page);
  const title = `Réserve Banyra ${Date.now()}`;
  let itemId: string | undefined;
  try {
    await page.goto(`/pilot/reserves/${projectId}`);
    await page.getByRole('button', { name: 'Nouvel élément', exact: true }).click();
    await page.locator('#punch-title').fill(title);
    await page.locator('#punch-description').fill('Finition du mur à reprendre avant réception.');
    await page.locator('#punch-due-date').fill('2026-12-15');
    const created = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/punchlist/items/');
    await page.getByRole('button', { name: "Créer l'élément", exact: true }).click();
    const createdResponse = await created;
    expect(createdResponse.ok()).toBe(true);
    itemId = (await createdResponse.json()).id;
    await page.getByText(title, { exact: true }).first().click();
    const image = await page.screenshot({ clip: { x: 0, y: 0, width: 32, height: 32 } });
    const uploaded = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes(`/punchlist/items/${itemId}/photos/`));
    await page.locator('input[type=file][accept="image/*"][multiple]').last().setInputFiles({ name: 'reserve.png', mimeType: 'image/png', buffer: image });
    const response = await uploaded;
    expect(response.ok()).toBe(true);
    expect((await response.json()).photos).toHaveLength(1);
    await expect(page.locator('.cp-sidebar')).toBeVisible();
  } finally {
    if (itemId) await page.evaluate(async (id) => {
      const token = sessionStorage.getItem('oe_access_token') || localStorage.getItem('oe_access_token');
      const response = await fetch(`/api/v1/punchlist/items/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Could not remove the validation reserve');
    }, itemId);
  }
});
