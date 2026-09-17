import { defineConfig, devices } from "@playwright/test";

import { ARTIFACT_DIR, BASE_URL } from "./tests/e2e/support/environment";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: `${ARTIFACT_DIR}/output`,
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: Number(process.env.WELLPLACE_E2E_WORKERS ?? 1),
  reporter: [["list"], ["json", { outputFile: `${ARTIFACT_DIR}/results.json` }]],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
