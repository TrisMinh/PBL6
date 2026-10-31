import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/shared/api/config", () => ({ isMockApi: false, apiBaseUrl: "" }));
import { backendAuthRepository } from "./backendAuthRepository";

beforeEach(() => {
  sessionStorage.clear();
});
it("maps the login request and real JWT session to existing UI state", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      accessToken: "header.payload.signature",
      refreshToken: "refresh-secret",
      tokenType: "Bearer",
      expiresIn: 900,
      sessionId: "019a3a71-0000-7000-8000-000000000001",
      user: {
        id: "019a3a71-0000-7000-8000-000000000002",
        roles: ["PLATFORM_ADMIN"],
      },
    }),
  );
  const result = await backendAuthRepository.login({
    email: "admin@example.com",
    password: "Password123",
  });
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
    identifier: "admin@example.com",
    password: "Password123",
  });
  expect(result.role).toBe("admin");
  expect(result.token).toBe("header.payload.signature");
});
it("does not send an OAuth simulation request in live mode", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  await expect(
    backendAuthRepository.oauth({ provider: "google" }),
  ).rejects.toMatchObject({ status: 501 });
  expect(fetcher).not.toHaveBeenCalled();
});
