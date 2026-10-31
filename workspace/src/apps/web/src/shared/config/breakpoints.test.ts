import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { BREAKPOINTS } from "@/shared/config/breakpoints";

describe("responsive navigation contract", () => {
  it.each([
    ["CustomerLayout", BREAKPOINTS.customerNavigation],
    ["AdminLayout", BREAKPOINTS.adminNavigation],
  ])(
    "keeps %s CSS and JavaScript at the same desktop boundary",
    (layout, breakpoint) => {
      const css = readFileSync(
        resolve("src/shared/layouts", `${layout}.css`),
        "utf8",
      );
      expect(css).toContain(`@media (min-width: ${breakpoint}px)`);
    },
  );
});
