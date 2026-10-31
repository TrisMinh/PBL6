import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("./config", () => ({ isMockApi: false, apiBaseUrl: "" }));
import { apiFetch, apiJson, logoutApi, refreshAccessToken } from "./client";
import { readApiSession, saveApiSession, type BackendSession } from "./session";

const session: BackendSession = {
  accessToken: "old.jwt.token",
  refreshToken: "refresh-secret",
  tokenType: "Bearer",
  expiresIn: 3600,
  sessionId: "019a3a71-0000-7000-8000-000000000001",
  user: { id: "019a3a71-0000-7000-8000-000000000002", roles: ["CUSTOMER"] },
};
const rotated = {
  ...session,
  accessToken: "new.jwt.token",
  refreshToken: "next-secret",
};
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("live API transport", () => {
  it("adds Bearer auth, removes mock credentials and preserves the caller's idempotency key", async () => {
    saveApiSession(session);
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    await apiFetch("/api/v1/bookings", {
      method: "POST",
      body: "{}",
      headers: {
        "X-Mock-Session-Token": "fake",
        "Idempotency-Key": "stable-attempt",
      },
    });
    const init = fetchMock.mock.calls[0][1];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer old.jwt.token");
    expect(headers.has("X-Mock-Session-Token")).toBe(false);
    expect(headers.get("Idempotency-Key")).toBe("stable-attempt");
  });
  it("does not attach credentials to anonymous requests or external URLs", async () => {
    saveApiSession(session);
    fetchMock.mockResolvedValue(Response.json({}));
    await apiFetch("/api/v1/trips", { auth: false });
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).has("Authorization"),
    ).toBe(false);
    await expect(
      apiFetch("https://untrusted.invalid/api/v1/bookings"),
    ).rejects.toMatchObject({ code: "INVALID_API_PATH" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("coalesces concurrent 401 refreshes, rotates tokens and retries each request once", async () => {
    saveApiSession(session);
    fetchMock.mockImplementation(async (path, init) => {
      if (String(path).endsWith("/auth/refresh")) return Response.json(rotated);
      const auth = new Headers(init?.headers).get("Authorization");
      return auth === "Bearer old.jwt.token"
        ? new Response(null, { status: 401 })
        : Response.json({ ok: true });
    });
    const responses = await Promise.all([
      apiFetch("/api/v1/bookings"),
      apiFetch("/api/v1/tickets"),
    ]);
    expect(responses.every((r) => r.ok)).toBe(true);
    expect(
      fetchMock.mock.calls.filter(([path]) =>
        String(path).endsWith("/auth/refresh"),
      ),
    ).toHaveLength(1);
    expect(readApiSession()?.refreshToken).toBe("next-secret");
  });
  it("reuses refresh idempotency key when a rotation response is lost", async () => {
    saveApiSession(session);
    fetchMock
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(Response.json(rotated));
    await expect(refreshAccessToken()).rejects.toThrow();
    await refreshAccessToken();
    const keys = fetchMock.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get("Idempotency-Key"),
    );
    expect(keys[0]).toBe(keys[1]);
  });
  it("does not resurrect a signed-out session when a refresh completes late", async () => {
    saveApiSession(session);
    let finish!: (response: Response) => void;
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(new Response(null, { status: 204 }));
    const refresh = refreshAccessToken();
    const check = expect(refresh).rejects.toMatchObject({
      code: "SESSION_CHANGED",
    });
    await logoutApi();
    finish(Response.json(rotated));
    await check;
    expect(readApiSession()).toBeNull();
  });
  it("clears revoked sessions and never loops indefinitely on 401", async () => {
    saveApiSession(session);
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(apiFetch("/api/v1/tickets")).rejects.toMatchObject({
      status: 401,
    });
    expect(readApiSession()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("exposes backend error envelopes and correlation IDs", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: { code: "ACCESS_DENIED", message: "Denied" },
          correlationId: "support-id",
        },
        { status: 403 },
      ),
    );
    await expect(
      apiJson("/api/v1/admin/users", z.unknown()),
    ).rejects.toMatchObject({
      code: "ACCESS_DENIED",
      status: 403,
      correlationId: "support-id",
    });
  });
  it("rejects invalid responses and unsupported mock endpoints instead of returning fake success", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 5 }));
    await expect(
      apiJson("/api/v1/bookings", z.object({ id: z.string() })),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(
      apiFetch("/api/v1/operator/vehicles-preview"),
    ).rejects.toMatchObject({ code: "FEATURE_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("normalizes caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));
    await expect(
      apiFetch("/api/v1/trips", { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "ABORTED" });
  });
  it("allows the real cancellation-preview endpoint", async () => {
    fetchMock.mockResolvedValue(Response.json({ previewId: "preview" }));
    await apiFetch("/api/v1/bookings/booking-id/cancellation-preview", {
      method: "POST",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
