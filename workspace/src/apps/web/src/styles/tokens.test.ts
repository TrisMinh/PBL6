import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TASK1_CSS_FILES = [
  "src/features/home/components/HomeFooter/HomeFooter.css",
  "src/features/home/components/PopularRoutes/PopularRoutes.css",
  "src/features/home/components/ProductTruths/ProductTruths.css",
  "src/features/home/components/SupportBanner/SupportBanner.css",
  "src/features/home/components/TrustJourney/TrustJourney.css",
  "src/features/home/pages/HomePage.css",
  "src/features/trips/components/HomeHero/HomeHero.css",
  "src/features/trips/components/SearchForm/SearchForm.css",
  "src/shared/layouts/CustomerLayout.css",
  "src/shared/ui/BrandLogo/BrandLogo.css",
] as const;

const REQUIRED_TASK1_TOKENS = [
  "--color-bg-customer-canvas",
  "--color-bg-editorial-surface",
  "--color-brand-editorial",
  "--color-text-editorial-heading",
  "--color-text-editorial-copy",
  "--color-border-editorial",
  "--color-overlay-route-strong",
  "--shadow-customer-header",
  "--shadow-hero-frame",
  "--shadow-route-card",
  "--shadow-trust-visual",
  "--shadow-support-card",
] as const;

const TASK2_CSS_FILES = [
  "src/features/trips/pages/TripResultsPage.css",
  "src/features/trips/components/TripFilters/TripFilters.css",
  "src/features/trips/components/TripCard/TripCard.css",
] as const;

const REQUIRED_TASK2_TOKENS = [
  "--color-results-canvas",
  "--color-results-surface",
  "--color-results-control",
  "--color-results-chip",
  "--color-results-text",
  "--color-results-text-secondary",
  "--color-results-text-muted",
  "--color-results-accent",
  "--color-results-active",
  "--color-results-border",
  "--color-results-control-border",
  "--color-results-success",
  "--shadow-results-panel",
  "--shadow-results-card",
] as const;

const TASK6_CSS_FILES = ["src/features/auth/components/AuthShell.css"] as const;

const REQUIRED_TASK6_TOKENS = [
  "--color-auth-canvas",
  "--color-auth-surface",
  "--color-auth-ink",
  "--color-auth-muted",
  "--color-auth-brand",
  "--color-auth-active",
  "--color-auth-border",
  "--color-auth-assistant",
  "--color-auth-divider",
  "--color-auth-on-image",
  "--shadow-auth-shell",
  "--shadow-auth-action",
  "--shadow-auth-story",
] as const;

const TASK7_CSS_FILES = [
  "src/features/cancellation/pages/CancellationPage.css",
  "src/features/cancellation/components/CancellationSelector/CancellationSelector.css",
  "src/features/cancellation/components/CancellationConfirmDialog/CancellationConfirmDialog.css",
] as const;

const REQUIRED_TASK7_TOKENS = [
  "--color-cancellation-surface",
  "--color-cancellation-panel",
  "--color-cancellation-control",
  "--color-cancellation-accent-soft",
  "--color-cancellation-success-soft",
  "--color-cancellation-warning-soft",
  "--color-cancellation-text",
  "--color-cancellation-copy",
  "--color-cancellation-muted",
  "--color-cancellation-accent",
  "--color-cancellation-compact-copy",
  "--color-cancellation-compact-accent",
  "--color-cancellation-success",
  "--color-cancellation-border",
  "--color-cancellation-border-strong",
  "--shadow-cancellation-ticket",
] as const;

describe("Task 1 semantic token contract", () => {
  it.each(TASK1_CSS_FILES)(
    "%s contains no primitive color or shadow values",
    (relativePath) => {
      const css = readFileSync(resolve(relativePath), "utf8");

      expect(css, relativePath).not.toMatch(/#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/i);
      for (const declaration of css.matchAll(
        /(?:box|text)-shadow\s*:\s*([^;]+)/gi,
      )) {
        expect(declaration[1]?.trim(), relativePath).toMatch(/^var\(/);
      }
    },
  );

  it("defines every Home and customer-shell semantic role in the canonical layer", () => {
    const tokens = readFileSync(resolve("src/styles/tokens.css"), "utf8");

    for (const token of REQUIRED_TASK1_TOKENS) {
      expect(tokens).toContain(`${token}:`);
    }
  });
});

describe("Task 2 Results semantic token contract", () => {
  it.each(TASK2_CSS_FILES)(
    "%s contains no primitive color or shadow values",
    (relativePath) => {
      const css = readFileSync(resolve(relativePath), "utf8");

      expect(css, relativePath).not.toMatch(/#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/i);
      for (const declaration of css.matchAll(
        /(?:box|text)-shadow\s*:\s*([^;]+)/gi,
      )) {
        expect(declaration[1]?.trim(), relativePath).toMatch(/^var\(/);
      }
    },
  );

  it("defines every Results semantic role in the canonical layer", () => {
    const tokens = readFileSync(resolve("src/styles/tokens.css"), "utf8");

    for (const token of REQUIRED_TASK2_TOKENS) {
      expect(tokens).toContain(`${token}:`);
    }
  });
});

describe("Task 6 Auth semantic token contract", () => {
  it.each(TASK6_CSS_FILES)(
    "%s contains no primitive color or shadow values",
    (relativePath) => {
      const css = readFileSync(resolve(relativePath), "utf8");
      expect(css, relativePath).not.toMatch(/#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/i);
      for (const declaration of css.matchAll(
        /(?:box|text)-shadow\s*:\s*([^;]+)/gi,
      )) {
        expect(declaration[1]?.trim(), relativePath).toMatch(/^var\(/);
      }
    },
  );

  it("defines every Auth semantic role in the canonical layer", () => {
    const tokens = readFileSync(resolve("src/styles/tokens.css"), "utf8");
    for (const token of REQUIRED_TASK6_TOKENS)
      expect(tokens).toContain(`${token}:`);
  });
});

describe("Task 7 Cancellation semantic token contract", () => {
  it.each(TASK7_CSS_FILES)(
    "%s contains no primitive color or shadow values",
    (relativePath) => {
      const css = readFileSync(resolve(relativePath), "utf8");
      expect(css, relativePath).not.toMatch(/#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/i);
      for (const declaration of css.matchAll(
        /(?:box|text)-shadow\s*:\s*([^;]+)/gi,
      ))
        expect(declaration[1]?.trim(), relativePath).toMatch(/^var\(/);
    },
  );

  it("defines every Cancellation semantic role in the canonical layer", () => {
    const tokens = readFileSync(resolve("src/styles/tokens.css"), "utf8");
    for (const token of REQUIRED_TASK7_TOKENS)
      expect(tokens).toContain(`${token}:`);
  });
});
