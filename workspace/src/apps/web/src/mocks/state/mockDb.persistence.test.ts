import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { z } from "zod";

import { createBookingHandlers } from "@/mocks/handlers/bookingHandlers";
import { server } from "@/mocks/server";
import { createMockDb, type MockDb } from "@/mocks/state/mockDb";
import { MOCK_BOOKING_STORAGE_KEY as KEY } from "@/mocks/state/mockSnapshot";

const TRIP_ID = "trip-hcm-dalat-early";
const NOW = Date.parse("2026-10-20T00:00:00Z");
const responseSchema = z.object({
  sessionId: z.string(),
  expiresAt: z.string(),
});

interface FakeStorage {
  getItem: Mock<(key: string) => string | null>;
  setItem: Mock<(key: string, value: string) => void>;
  removeItem: Mock<(key: string) => void>;
}
function fakeStorage(): FakeStorage {
  const entries = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      entries.delete(key);
    }),
  };
}

async function send(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(new URL(path, window.location.origin), {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "refresh-key",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function selectSession(storage: FakeStorage): Promise<{
  db: MockDb;
  session: z.infer<typeof responseSchema>;
  seatIds: string[];
}> {
  const db = createMockDb({ storage });
  server.use(
    ...createBookingHandlers({
      db,
      now: () => NOW,
      createSessionId: () => "persisted-session",
    }),
  );
  const session = responseSchema.parse(
    await (
      await send("POST", "/api/v1/booking-sessions", {
        passengerCount: 2,
        tripId: TRIP_ID,
      })
    ).json(),
  );
  const seatIds = (db.seats.get(TRIP_ID) ?? [])
    .filter((seat) => seat.status === "available")
    .slice(0, 2)
    .map((seat) => seat.id);
  expect(
    (
      await send("PUT", `/api/v1/booking-sessions/${session.sessionId}/seats`, {
        seatIds,
      })
    ).status,
  ).toBe(200);
  return { db, session, seatIds };
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("mock booking refresh continuity", () => {
  it("does not write or alter persisted state on a conflicting selection", async () => {
    const storage = fakeStorage();
    const { db, session } = await selectSession(storage);
    const saved = storage.getItem(KEY);
    const before = structuredClone([...db.sessions]);
    storage.setItem.mockClear();
    const response = await send(
      "PUT",
      `/api/v1/booking-sessions/${session.sessionId}/seats`,
      { seatIds: ["unknown-private-id"] },
    );
    expect(response.status).toBe(409);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem(KEY)).toBe(saved);
    expect([...db.sessions]).toEqual(before);
  });

  it("removes active-session snapshot when a request discovers expiry", async () => {
    const storage = fakeStorage();
    const { db, session } = await selectSession(storage);
    expect(storage.getItem(KEY)).not.toBeNull();
    server.use(...createBookingHandlers({ db, now: () => NOW + 600_000 }));
    const response = await send(
      "PUT",
      `/api/v1/booking-sessions/${session.sessionId}/seats`,
      { seatIds: [] },
    );
    expect(response.status).toBe(410);
    expect(storage.getItem(KEY)).toBeNull();
    expect(db.holds.size).toBe(0);
  });

  it("lazily restores original expiry, holds, ownership, fare and idempotency after reconstruction", async () => {
    const storage = fakeStorage();
    const { db, session, seatIds } = await selectSession(storage);
    expect(storage.getItem(KEY)).not.toBeNull();
    storage.getItem.mockClear();
    const restored = createMockDb({ storage });
    expect(storage.getItem).not.toHaveBeenCalled();
    server.use(
      ...createBookingHandlers({ db: restored, now: () => NOW + 60_000 }),
    );
    const replay = await send("POST", "/api/v1/booking-sessions", {
      passengerCount: 2,
      tripId: TRIP_ID,
    });
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(db.sessions.get(session.sessionId));
    expect(restored.sessions.get(session.sessionId)?.expiresAt).toBe(
      session.expiresAt,
    );
    expect(restored.holds).toEqual(db.holds);
    expect(restored.seats).toEqual(db.seats);
    expect(restored.trips).toEqual(db.trips);
    expect(restored.sessionKeys.get("refresh-key")).toBe(session.sessionId);
    expect(
      seatIds.every((id) => restored.holds.get(id) === session.sessionId),
    ).toBe(true);
  });

  it("discards expired snapshot rather than renewing the hold", async () => {
    const storage = fakeStorage();
    const { session } = await selectSession(storage);
    expect(storage.getItem(KEY)).not.toBeNull();
    const restored = createMockDb({ storage });
    server.use(
      ...createBookingHandlers({ db: restored, now: () => NOW + 600_000 }),
    );
    const response = await send(
      "PUT",
      `/api/v1/booking-sessions/${session.sessionId}/seats`,
      { seatIds: [] },
    );
    expect(response.status).toBe(404);
    expect(storage.getItem(KEY)).toBeNull();
    expect(restored.sessions.size).toBe(0);
    expect(restored.holds.size).toBe(0);
  });

  it.each([
    "not-json",
    JSON.stringify({ version: 1, sessions: "private-payload" }),
  ])(
    "fails closed on malformed snapshots without returning payload",
    async (value) => {
      const storage = fakeStorage();
      storage.setItem(KEY, value);
      const restored = createMockDb({ storage });
      server.use(...createBookingHandlers({ db: restored, now: () => NOW }));
      const response = await send("PUT", "/api/v1/booking-sessions/old/seats", {
        seatIds: [],
      });
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("private-payload");
      expect(storage.getItem(KEY)).toBeNull();
      expect(restored.sessions.size).toBe(0);
    },
  );

  it("reset clears the snapshot and restores immutable seed state", async () => {
    const storage = fakeStorage();
    const { db } = await selectSession(storage);
    expect(storage.getItem(KEY)).not.toBeNull();
    db.reset();
    expect(storage.getItem(KEY)).toBeNull();
    expect(db.trips).toEqual(createMockDb().trips);
    expect(db.seats).toEqual(createMockDb().seats);
    expect(db.holds.size).toBe(0);
  });
});

const storedSchema = z.object({
  version: z.number(),
  sessions: z.array(
    z.object({
      passengerCount: z.number().int().min(1).max(6),
      sessionId: z.string(),
      tripId: z.string(),
      selectedSeatIds: z.array(z.string()),
      passengers: z.array(
        z.object({ seatId: z.string(), fullName: z.string() }),
      ),
      expiresAt: z.string(),
      totalVnd: z.number(),
      status: z.string(),
    }),
  ),
  sessionKeys: z.array(z.tuple([z.string(), z.string()])),
});
type Stored = z.infer<typeof storedSchema>;
const mutations: [string, (snapshot: Stored) => void][] = [
  [
    "unknown trip",
    (data) => {
      for (const session of data.sessions) session.tripId = "unknown";
    },
  ],
  [
    "unknown seat",
    (data) => {
      for (const session of data.sessions)
        session.selectedSeatIds = ["unknown"];
    },
  ],
  [
    "sold seat",
    (data) => {
      for (const session of data.sessions)
        session.selectedSeatIds = [`${TRIP_ID}:A09`];
    },
  ],
  [
    "wrong total",
    (data) => {
      for (const session of data.sessions) session.totalVnd = 1;
    },
  ],
  [
    "duplicate seats",
    (data) => {
      for (const session of data.sessions)
        session.selectedSeatIds.push(...session.selectedSeatIds);
    },
  ],
  [
    "invalid passenger",
    (data) => {
      for (const session of data.sessions)
        session.passengers = [{ seatId: "unknown", fullName: "private-name" }];
    },
  ],
  [
    "duplicate sessions",
    (data) => {
      data.sessions.push(...structuredClone(data.sessions));
    },
  ],
  [
    "cross-session hold",
    (data) => {
      for (const session of [...data.sessions])
        data.sessions.push({ ...session, sessionId: "other-session" });
    },
  ],
  [
    "orphan key",
    (data) => {
      data.sessionKeys.push(["other-key", "missing-session"]);
    },
  ],
  [
    "duplicate key",
    (data) => {
      data.sessionKeys.push(...structuredClone(data.sessionKeys));
    },
  ],
  [
    "future extension",
    (data) => {
      for (const session of data.sessions)
        session.expiresAt = new Date(NOW + 600_001).toISOString();
    },
  ],
];

describe("untrusted mock snapshot boundary", () => {
  it.each(mutations)(
    "rejects %s without partially applying holds",
    async (_, mutate) => {
      const storage = fakeStorage();
      await selectSession(storage);
      const saved = storage.getItem(KEY);
      expect(saved).not.toBeNull();
      const data = storedSchema.parse(JSON.parse(saved ?? "null"));
      mutate(data);
      storage.setItem(KEY, JSON.stringify(data));
      const restored = createMockDb({ storage });
      restored.hydrate(NOW);
      expect(restored.sessions.size).toBe(0);
      expect(restored.holds.size).toBe(0);
      expect(restored.seats).toEqual(createMockDb().seats);
      expect(storage.getItem(KEY)).toBeNull();
    },
  );

  it("rejects snapshots over the bounded storage size", () => {
    const storage = fakeStorage();
    storage.setItem(KEY, "x".repeat(262_145));
    const db = createMockDb({ storage });
    db.hydrate(NOW);
    expect(db.sessions.size).toBe(0);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("keeps memory working when reads/writes/removal are denied", async () => {
    const storage = fakeStorage();
    const denied = (): never => {
      throw new DOMException("Denied", "SecurityError");
    };
    storage.getItem.mockImplementation(denied);
    storage.setItem.mockImplementation(denied);
    storage.removeItem.mockImplementation(denied);
    const { db, session } = await selectSession(storage);
    expect(db.sessions.get(session.sessionId)?.selectedSeatIds).toHaveLength(2);
    expect(() => db.reset()).not.toThrow();
  });

  it("preserves contact/passengers on refresh and clears completed/expired snapshots on save", async () => {
    const storage = fakeStorage();
    const { db, session, seatIds } = await selectSession(storage);
    const contact = {
      fullName: "Mock Guest",
      email: "mock@example.invalid",
      phone: "mock-phone",
    };
    const passengers = seatIds.map((seatId) => ({
      seatId,
      fullName: "Mock Guest",
    }));
    expect(
      (
        await send(
          "PUT",
          `/api/v1/booking-sessions/${session.sessionId}/passengers`,
          { contact, passengers },
        )
      ).status,
    ).toBe(200);
    const restored = createMockDb({ storage });
    restored.hydrate(NOW + 1_000);
    expect(restored.sessions.get(session.sessionId)).toEqual({
      ...db.sessions.get(session.sessionId),
      contact,
      passengers,
    });
    for (const active of restored.sessions.values())
      active.status = "completed";
    restored.save(NOW + 1_000);
    expect(storage.getItem(KEY)).toBeNull();
  });
});
