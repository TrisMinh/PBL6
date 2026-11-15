import { beforeEach, expect, it } from "vitest";
import { server } from "../server";
import { createAuthHandlers } from "../handlers/authHandlers";
import { createMockDb } from "./mockDb";
import { completeDemoChallenge } from "./customerAccounts";

beforeEach(() => {
  sessionStorage.clear();
  server.use(...createAuthHandlers({ db: createMockDb() }));
});

async function post(action: string, body: unknown): Promise<Response> {
  return fetch(`/api/v1/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

it("registers, verifies and signs in a demo user, then resets the demo password without persisting plaintext", async () => {
  const email = "new-customer@example.invalid";
  expect(
    (
      await post("register", {
        email,
        fullName: "Khách mới",
        phone: "0912345678",
        password: "DemoPass123",
        confirmPassword: "DemoPass123",
      })
    ).status,
  ).toBe(202);
  expect((await post("login", { email, password: "DemoPass123" })).status).toBe(
    401,
  );
  await completeDemoChallenge(false);
  expect((await post("login", { email, password: "DemoPass123" })).status).toBe(
    200,
  );
  expect((await post("forgot-password", { email })).status).toBe(202);
  await completeDemoChallenge(true, "ChangedDemo123");
  expect((await post("login", { email, password: "DemoPass123" })).status).toBe(
    401,
  );
  expect(
    (await post("login", { email, password: "ChangedDemo123" })).status,
  ).toBe(200);
  expect(JSON.stringify({ ...sessionStorage })).not.toContain("ChangedDemo123");
  expect(JSON.stringify({ ...sessionStorage })).not.toContain("DemoPass123");
});

it("keeps a registered customer's session valid after serializing and restoring the mock archive", async () => {
  const { createAuthHandlers } = await import("../handlers/authHandlers");
  const { createMockDb } = await import("./mockDb");
  const memory = new Map<string, string>();
  const storage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: (k: string) => {
      memory.delete(k);
    },
  };
  const db = createMockDb({ storage });
  server.use(...createAuthHandlers({ db }));
  const email = "persistent-new@example.invalid";
  await post("register", {
    email,
    fullName: "Khách mới",
    phone: "0912345678",
    password: "DemoPass123",
    confirmPassword: "DemoPass123",
  });
  await completeDemoChallenge(false);
  const response = await post("login", { email, password: "DemoPass123" });
  const grant = (await response.json()) as { token: string };
  const restored = createMockDb({ storage });
  restored.hydrate(Date.now());
  expect(restored.authSessions.has(grant.token)).toBe(true);
});
