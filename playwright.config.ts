import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env.STORYTELLING_E2E_PORT ?? 5179);
const e2eUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: e2eUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: `bun run dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eUrl,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
