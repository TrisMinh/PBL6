import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_SESSION_STORAGE_KEY } from "@/features/auth/config/session";
import {
  writeMockSession,
  clearMockSession,
} from "@/features/auth/lib/sessionStorage";

const session = {
  userId: "mock-customer",
  role: "customer" as const,
  token: crypto.randomUUID(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};
beforeEach(() => sessionStorage.clear());
describe("safe existing mock session storage", () => {
  it("persists safe projection and clears it", () => {
    expect(writeMockSession(session)).toBe(true);
    expect(
      JSON.parse(sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY) ?? "null"),
    ).toEqual(session);
    clearMockSession();
    expect(sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBeNull();
  });
  it("fails closed when browser storage is denied", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(writeMockSession(session)).toBe(false);
  });
});
