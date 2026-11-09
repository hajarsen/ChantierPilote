import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testData = mkdtempSync(join(tmpdir(), "banyra-browser-"));
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://127.0.0.1:8011",
    actionTimeout: 10000,
    navigationTimeout: 20000,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: process.env.BANYRA_CHROMIUM
      ? {
          executablePath: process.env.BANYRA_CHROMIUM,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--enable-unsafe-swiftshader",
            "--use-angle=swiftshader",
          ],
        }
      : {},
  },
  webServer: {
    command: ".venv/bin/uvicorn backend.app:app --host 127.0.0.1 --port 8011",
    cwd: "..",
    url: "http://127.0.0.1:8011/api/health",
    reuseExistingServer: false,
    env: {
      BANYRA_DATA_DIR: testData,
      BANYRA_SECURE_COOKIES: "0",
      BANYRA_PUBLIC_ORIGIN: "http://127.0.0.1:8011",
      BANYRA_ALLOW_REGISTRATION: "1",
    },
  },
});
