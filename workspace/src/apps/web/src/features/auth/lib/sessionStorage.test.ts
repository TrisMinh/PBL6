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
  it("clears the rejected session and notifies its guards", () => {
    writeMockSession(session);
    const notify = vi.fn();
    window.addEventListener("storage", notify);
    try {
      clearMockSession(session.token);
      expect(sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBeNull();
      expect(notify).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("storage", notify);
    }
  });
  it("preserves a replacement session when an older request fails", () => {
    writeMockSession(session);
    clearMockSession(crypto.randomUUID());
    expect(
      JSON.parse(sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY) ?? "null"),
    ).toEqual(session);
  });
});
