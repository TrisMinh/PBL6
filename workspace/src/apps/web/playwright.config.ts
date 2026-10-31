import { defineConfig } from "@playwright/test";

export default defineConfig({
  workers: 2,
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    env: { VITE_API_MODE: "mock" },
    command: `"${process.execPath}" node_modules/@react-router/dev/bin.cjs dev --host 127.0.0.1`,
    port: 5173,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "w360",
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 800 },
      },
    },
    {
      name: "w768",
      use: {
        browserName: "chromium",
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "w1024",
      use: {
        browserName: "chromium",
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "w1440",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "w1920",
      use: {
        browserName: "chromium",
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
