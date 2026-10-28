import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/banyra',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  use: {
    baseURL: process.env.BANYRA_BASE_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.BANYRA_CHROMIUM ? {
      executablePath: process.env.BANYRA_CHROMIUM,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    } : {},
  },
  outputDir: './test-results/banyra',
  reporter: [['list']],
});
