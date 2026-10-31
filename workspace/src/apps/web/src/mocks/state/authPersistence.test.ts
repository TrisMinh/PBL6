import { describe, expect, it } from "vitest";

import { createAuthHandlers } from "@/mocks/handlers/authHandlers";
import { createMockDb } from "@/mocks/state/mockDb";
import { MOCK_BOOKING_STORAGE_KEY } from "@/mocks/state/mockSnapshot";
import { server } from "@/mocks/server";

interface MemoryStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

async function setup(): Promise<{
  db: ReturnType<typeof createMockDb>;
  storage: MemoryStorage;
  now: number;
  session: { token: string };
}> {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
  const db = createMockDb({ storage }),
    now = Date.now();
  server.use(...createAuthHandlers({ db, now: () => now }));
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test+review@example.invalid",
      password: "BlueDemo2026",
    }),
  });
  const session = await response.json();
  return { db, storage, now, session };
}
describe("auth session snapshot", () => {
  it("refresh restores original token/expiry without any email/password payload", async () => {
    const { storage, now, session } = await setup();
    const raw = storage.getItem(MOCK_BOOKING_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).not.toMatch(/email|password|BlueDemo|test\+review/);
    const restored = createMockDb({ storage });
    restored.hydrate(now + 1000);
    expect(restored.authSessions.get(session.token)).toMatchObject(session);
    restored.reset();
    expect(storage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
  });
  it.each(["userId", "role", "createdAt"])(
    "rejects forged session %s",
    async (field) => {
      const { storage, now } = await setup();
      const snapshot = JSON.parse(
        storage.getItem(MOCK_BOOKING_STORAGE_KEY) ?? "{}",
      );
      expect(snapshot.authSessions).toHaveLength(1);
      snapshot.authSessions[0][field] = "forged";
      storage.setItem(MOCK_BOOKING_STORAGE_KEY, JSON.stringify(snapshot));
      const restored = createMockDb({ storage });
      restored.hydrate(now);
      expect(restored.authSessions.size).toBe(0);
      expect(storage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
    },
  );
  it("expired sessions are removed without extending expiry", async () => {
    const { storage, now } = await setup();
    const restored = createMockDb({ storage });
    restored.hydrate(now + 3_600_000);
    expect(restored.authSessions.size).toBe(0);
    expect(storage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
  });
});
