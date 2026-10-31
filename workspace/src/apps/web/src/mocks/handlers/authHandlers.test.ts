import { beforeEach, describe, expect, it } from "vitest";

import { createAuthHandlers } from "@/mocks/handlers/authHandlers";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { issueTestTickets } from "@/test/tickets";

let now = Date.now();
const email = "test+review@example.invalid",
  password = "BlueDemo2026";
beforeEach(() => {
  now = Date.now();
  mockDb.reset();
  server.use(
    ...createAuthHandlers({
      db: mockDb,
      now: () => now,
      scenariosEnabled: true,
    }),
  );
});
function post(action: string, body: unknown): Promise<Response> {
  return fetch(`/api/v1/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("mock auth HTTP", () => {
  it("account detail requires server ownership and never downgrades to a guest header", async () => {
    const issued = await issueTestTickets(),
      code = issued.tickets[0].ticketCode;
    const session = await (await post("login", { email, password })).json();
    const response = await fetch(`/api/v1/tickets/${code}`, {
      headers: { "X-Mock-Session-Token": session.token },
    });
    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toMatch(
      /guestVerification|test\+review|phone|token/,
    );
    const original = [...mockDb.tickets.values()][0];
    if (!original) throw new Error("missing fixture");
    mockDb.tickets.set(original.ticketId, {
      ...original,
      guestVerification: {
        ...original.guestVerification,
        email: "other@example.invalid",
      },
    });
    expect(
      (
        await fetch(`/api/v1/tickets/${code}`, {
          headers: { "X-Mock-Session-Token": session.token },
        })
      ).status,
    ).toBe(404);
    const guest = await (
      await fetch("/api/v1/tickets/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingCode: issued.bookingCode,
          verificationValue: "0912345678",
        }),
      })
    ).json();
    expect(
      (
        await fetch(`/api/v1/tickets/${code}`, {
          headers: {
            "X-Mock-Session-Token": "invalid",
            "X-Ticket-Lookup-Token": guest.token,
          },
        })
      ).status,
    ).toBe(401);
  });
  it.each([
    [email, "customer"],
    ["admin@blue.example.invalid", "admin"],
  ])("issues a bounded safe session for %s", async (identity, role) => {
    const response = await post("login", {
      email: identity.toUpperCase(),
      password,
    });
    expect(response.status).toBe(200);
    const session = await response.json();
    expect(session).toEqual({
      userId: expect.any(String),
      role,
      token: expect.stringMatching(/^[a-z0-9-]{36}$/),
      expiresAt: new Date(now + 3_600_000).toISOString(),
    });
    expect(JSON.stringify(session)).not.toMatch(/email|password|BlueDemo/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each([
    { email, password: "WrongPass2026" },
    { email: "missing@example.invalid", password },
  ])("generic credentials failure", async (input) => {
    const response = await post("login", input);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "INVALID_CREDENTIALS",
      status: 401,
      traceId: expect.any(String),
    });
  });
  it.each(["google", "facebook"])(
    "provider %s explicitly succeeds/fails only in dev/test",
    async (provider) => {
      expect(
        (await post("oauth", { provider, scenario: "error" })).status,
      ).toBe(503);
      expect(
        (await post("oauth", { provider, scenario: "success" })).status,
      ).toBe(200);
      server.use(
        ...createAuthHandlers({
          db: mockDb,
          now: () => now,
          scenariosEnabled: false,
        }),
      );
      expect(
        (await post("oauth", { provider, scenario: "error" })).status,
      ).toBe(200);
    },
  );
  it.each([email, "missing@example.invalid"])(
    "register and forgot remain neutral for %s",
    async (identity) => {
      const register = await post("register", {
        email: identity,
        password,
        confirmPassword: password,
        fullName: "Demo User",
        phone: "0901234567",
      });
      const forgot = await post("forgot-password", { email: identity });
      expect(register.status).toBe(202);
      expect(forgot.status).toBe(202);
      expect(await register.json()).toEqual({ accepted: true });
      expect(await forgot.json()).toEqual({ accepted: true });
    },
  );
  it("rejects unknown body keys without echoing password", async () => {
    const response = await post("login", { email, password, role: "admin" });
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain(password);
  });
  it("history uses server identity and expires without ticket-code authority", async () => {
    await issueTestTickets();
    const session = await (await post("login", { email, password })).json();
    const history = await fetch("/api/v1/me/tickets?status=issued", {
      headers: { "X-Mock-Session-Token": session.token },
    });
    expect(history.status).toBe(200);
    const result = await history.json();
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(JSON.stringify(result)).not.toMatch(
      /guestVerification|test\+review|phone|token/,
    );
    expect((await fetch("/api/v1/me/tickets")).status).toBe(401);
    now += 3_600_000;
    expect(
      (
        await fetch("/api/v1/me/tickets", {
          headers: { "X-Mock-Session-Token": session.token },
        })
      ).status,
    ).toBe(401);
  });
});
