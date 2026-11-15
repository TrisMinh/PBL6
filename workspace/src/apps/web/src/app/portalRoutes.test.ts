import { expect, it } from "vitest";
import { createPortalRoutes } from "./portalRoutes";
import type { RouteConfigEntry } from "@react-router/dev/routes";

function paths(entries: RouteConfigEntry[]): string[] {
  return entries.flatMap((entry) => [
    entry.path ?? "",
    ...paths(entry.children ?? []),
  ]);
}
it("customer build cannot expose staff routes", () => {
  const routes = paths(createPortalRoutes("customer"));
  expect(routes).toContain("/trips");
  expect(routes.some((path) => /^\/(operator|admin)/.test(path))).toBe(false);
});
it("operator build contains its resources and login but no customer checkout or admin", () => {
  const routes = paths(createPortalRoutes("operator"));
  expect(routes).toContain("/operator/trips");
  expect(routes).toContain("/operator/organization");
  expect(routes).toContain("/login");
  expect(
    routes.some((path) =>
      /^\/(admin|booking|payment|account|trips)/.test(path),
    ),
  ).toBe(false);
});
it("admin build contains transaction and staff screens but no customer or operator", () => {
  const routes = paths(createPortalRoutes("admin"));
  expect(routes).toContain("/admin/organizations");
  expect(routes).toContain("/admin/refunds/:refundId");
  expect(routes).toContain("/login");
  expect(
    routes.some((path) =>
      /^\/(operator|booking|payment|account|trips)/.test(path),
    ),
  ).toBe(false);
});
