import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/live",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `"${process.execPath}" node_modules/@react-router/dev/bin.cjs dev --host 127.0.0.1 --port 5174`,
    port: 5174,
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_MODE: "live", VITE_API_BASE_URL: "" },
  },
});
