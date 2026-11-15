import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/portals",
  outputDir: "test-results-portals",
  workers: 1,
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5273",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 360, height: 800 } } },
  ],
  webServer: ["customer", "operator", "admin"].map((target, index) => ({
    command: `"${process.execPath}" scripts/serve-portal.mjs ${target} ${5273 + index}`,
    port: 5273 + index,
    reuseExistingServer: false,
  })),
});
