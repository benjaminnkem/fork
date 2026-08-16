import { defineConfig, devices } from "@playwright/test";

const live = process.env.RUN_WEB_E2E === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !live,
  timeout: live ? 300_000 : 30_000,
  expect: { timeout: live ? 60_000 : 5_000 },
  use: {
    baseURL: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
