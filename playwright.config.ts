import { defineConfig, devices } from "@playwright/test";
import { authFile } from "./tests/support/real-backend.ts";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  timeout: 600_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    storageState: authFile,
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-pixel-7",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
