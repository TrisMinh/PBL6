import { afterEach, expect, it } from "vitest";

import { createBookingHandlers } from "@/mocks/handlers/bookingHandlers";
import { createOrderHandlers } from "@/mocks/handlers/createBookingHandlers";
import { server } from "@/mocks/server";
import { createMockDb, type MockDb } from "@/mocks/state/mockDb";
import {
  MOCK_BOOKING_STORAGE_KEY,
  type MockStorage,
} from "@/mocks/state/mockSnapshot";
import { createReadyBookingSession } from "@/test/booking";

let db: MockDb | undefined;
afterEach(() => db?.reset());
function memory(): MockStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
async function setup(): Promise<{
  storage: MockStorage;
  id: string;
  expiry: string;
  now: number;
}> {
  const storage = memory();
  const now = Date.now();
  db = createMockDb({ storage });
  server.use(
    ...createBookingHandlers({ db, now: () => now }),
    ...createOrderHandlers({ db, now: () => now }),
  );
  const session = await createReadyBookingSession();
  const response = await fetch("/api/v1/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "stable-attempt",
    },
    body: JSON.stringify({ sessionId: session.sessionId }),
  });
  expect(response.status).toBe(201);
  return { storage, id: session.sessionId, expiry: session.expiresAt, now };
}
it("rehydrates immutable booking/key/ownership and replays original booking without extending expiry", async () => {
  const { storage, id, expiry, now } = await setup();
  const first = db?.sessions.get(id)?.bookingId;
  const fresh = createMockDb({ storage });
  fresh.hydrate(now + 1000);
  expect(fresh.sessions.get(id)).toMatchObject({
    bookingId: first,
    bookingAttemptKey: "stable-attempt",
    expiresAt: expiry,
  });
  expect(fresh.bookings.size).toBe(1);
  expect(fresh.bookingKeys.get("stable-attempt")).toBe(first);
  expect(Object.isFrozen(first ? fresh.bookings.get(first) : undefined)).toBe(
    true,
  );
  expect(fresh.holds.size).toBe(2);
  server.use(...createOrderHandlers({ db: fresh, now: () => now + 1000 }));
  const response = await fetch("/api/v1/bookings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "stable-attempt",
    },
    body: JSON.stringify({ sessionId: id }),
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual(
    first ? fresh.bookings.get(first) : undefined,
  );
  fresh.reset();
  expect(storage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
  expect(fresh.bookings.size).toBe(0);
});
it.each(["total", "key", "duplicate", "expired"])(
  "discards %s persisted booking snapshot fail-closed",
  async (mode) => {
    const { storage, now } = await setup();
    const raw = JSON.parse(storage.getItem(MOCK_BOOKING_STORAGE_KEY) ?? "null");
    if (mode === "total") raw.bookings[0].totalVnd++;
    if (mode === "key") raw.bookingKeys[0][1] = "foreign";
    if (mode === "duplicate") raw.bookings.push(raw.bookings[0]);
    storage.setItem(MOCK_BOOKING_STORAGE_KEY, JSON.stringify(raw));
    const fresh = createMockDb({ storage });
    fresh.hydrate(now + (mode === "expired" ? 600001 : 1000));
    expect(fresh.sessions.size).toBe(0);
    expect(fresh.bookings.size).toBe(0);
    expect(fresh.bookingKeys.size).toBe(0);
    expect(storage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
  },
);
