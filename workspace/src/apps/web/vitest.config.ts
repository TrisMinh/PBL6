import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    exclude: [
      ...configDefaults.exclude,
      "scripts/**/*.test.mjs",
      "tests/prerender/**",
      "tests/e2e/**",
      "tests/live/**",
    ],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    coverage: { provider: "v8", reporter: ["text", "html"] },
  },
});
