import { describe, expect, it } from "vitest";
import { workspaceAccess, workspaceRedirect } from "./workspaceAccess";
import { backendSessionSchema, type StoredSession } from "@/shared/api/session";

function session(
  roles: string[] = [],
  status = "ACTIVE",
  memberRoles = ["OPERATOR_ADMIN"],
): StoredSession {
  return {
    ...backendSessionSchema.parse({
      accessToken: "test",
      refreshToken: "test",
      tokenType: "Bearer",
      expiresIn: 3600,
      sessionId: "019aff01-0000-7000-8000-000000091001",
      user: {
        id: "019aff01-0000-7000-8000-000000091002",
        roles,
        organizationMemberships: [{ status, roleCodes: memberRoles }],
      },
    }),
    expiresAt: Date.now() + 3600000,
  };
}
describe("workspace navigation", () => {
  it("reads organization membership roles even when global roles are empty", () => {
    expect(workspaceAccess(session()).home).toBe("/operator/trips");
  });
  it("ignores inactive memberships", () => {
    expect(workspaceAccess(session([], "INACTIVE")).operator).toBe(false);
  });
  it("takes platform admins to system administration", () => {
    expect(workspaceRedirect(undefined, session(["PLATFORM_ADMIN"]))).toBe(
      "/admin/organizations",
    );
  });
  it("returns an operator to a protected deep link after login", () => {
    expect(
      workspaceRedirect("/operator/vehicles?edit=vehicle-1", session()),
    ).toBe("/operator/vehicles?edit=vehicle-1");
  });
  it("does not send customers into a management workspace", () => {
    expect(
      workspaceRedirect("/operator/trips", session([], "ACTIVE", [])),
    ).toBe("/account/tickets");
  });
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/operator/%2e%2e/%2f%2fevil.test",
  ])("rejects an unsafe redirect %s", (input) => {
    expect(workspaceRedirect(input, session())).toBe("/operator/trips");
  });
});
