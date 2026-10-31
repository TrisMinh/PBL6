import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { httpAuthRepository } from "@/features/auth/repositories/httpAuthRepository";
import { server } from "@/mocks/server";
import { mockDb } from "@/mocks/state/mockDb";

const credentials = {
  email: "test+review@example.invalid",
  password: "BlueDemo2026",
};
describe("auth typed repository", () => {
  it("parses opaque login/oauth and neutral register/forgot", async () => {
    mockDb.reset();
    expect(await httpAuthRepository.login(credentials)).toMatchObject({
      userId: "mock-customer",
      role: "customer",
      token: expect.any(String),
    });
    expect(
      await httpAuthRepository.oauth({ provider: "google" }),
    ).toMatchObject({ role: "customer" });
    await expect(
      httpAuthRepository.register({
        ...credentials,
        fullName: "Demo User",
        phone: "0901234567",
        confirmPassword: credentials.password,
      }),
    ).resolves.toBeUndefined();
    await expect(
      httpAuthRepository.forgot({ email: credentials.email }),
    ).resolves.toBeUndefined();
  });
  it("normalizes credential failure into stable code without raw messages", async () => {
    await expect(
      httpAuthRepository.login({ ...credentials, password: "WrongPass2026" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", status: 401 });
  });
  it.each([
    { role: "admin" },
    {
      userId: "a",
      role: "customer",
      token: crypto.randomUUID(),
      expiresAt: "2000-01-01T00:00:00Z",
    },
  ])("rejects malformed/expired resource", async (payload) => {
    server.use(
      http.post("/api/v1/auth/login", () => HttpResponse.json(payload)),
    );
    await expect(httpAuthRepository.login(credentials)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("forwards abort", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      httpAuthRepository.login(credentials, controller.signal),
    ).rejects.toMatchObject({ code: "ABORTED" });
  });
});
