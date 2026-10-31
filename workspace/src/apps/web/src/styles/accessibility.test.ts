import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_CSS_PATH = resolve("src/styles/app.css");
const SRC_PATH = resolve("src");

function readCssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return readCssFiles(path);
    return extname(entry.name) === ".css" ? [path] : [];
  });
}

describe("global accessibility styles", () => {
  const appCss = readFileSync(APP_CSS_PATH, "utf8");

  it("gives every keyboard-focused element a semantic visible outline", () => {
    expect(appCss).toMatch(
      /:focus-visible\s*{[^}]*outline:\s*3px solid var\(--color-focus-ring\);[^}]*outline-offset:\s*2px;/s,
    );
  });

  it("reduces animation, transitions and smooth scrolling globally", () => {
    expect(appCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{[\s\S]*?\*,\s*\*::before,\s*\*::after\s*{[^}]*scroll-behavior:\s*auto !important;[^}]*animation-duration:\s*0\.01ms !important;[^}]*animation-iteration-count:\s*1 !important;[^}]*transition-duration:\s*0\.01ms !important;/,
    );
  });

  it("does not suppress outlines without a replacement", () => {
    for (const path of readCssFiles(SRC_PATH)) {
      const css = readFileSync(path, "utf8");
      expect(css, path).not.toMatch(/outline:\s*(?:0|none)\b/);
    }
  });
});
