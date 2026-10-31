import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_SESSION_STORAGE_KEY } from "@/features/auth/config/session";
import { useMockSession } from "@/features/auth/hooks/useMockSession";

describe("extended existing mock session", () => {
  it("retains only validated opaque token in safe session projection", () => {
    const token = crypto.randomUUID();
    sessionStorage.setItem(
      MOCK_SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: "mock-customer",
        role: "customer",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        token,
      }),
    );
    expect(renderHook(useMockSession).result.current.session?.token).toBe(
      token,
    );
  });
  it("malformed opaque token fails closed", () => {
    sessionStorage.setItem(
      MOCK_SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: "mock-customer",
        role: "customer",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        token: "bad",
      }),
    );
    expect(renderHook(useMockSession).result.current.session).toBeNull();
  });
});
