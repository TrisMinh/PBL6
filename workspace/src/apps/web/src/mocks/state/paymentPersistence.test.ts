import { afterEach, describe, expect, it } from "vitest";

import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";
import type { BookingSession } from "@/features/booking/types/booking";
import type { PaymentTransaction } from "@/features/payment/types/payment";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { createBookingHandlers } from "@/mocks/handlers/bookingHandlers";
import { createOrderHandlers } from "@/mocks/handlers/createBookingHandlers";
import { createPaymentHandlers } from "@/mocks/handlers/paymentHandlers";
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
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v);
    },
    removeItem: (k) => {
      values.delete(k);
    },
  };
}
async function setup(): Promise<{
  storage: MockStorage;
  now: number;
  session: BookingSession;
  booking: BookingCreationSummary;
  transaction: PaymentTransaction;
}> {
  const storage = memory(),
    now = Date.now();
  db = createMockDb({ storage });
  server.use(
    ...createBookingHandlers({ db, now: () => now }),
    ...createOrderHandlers({ db, now: () => now }),
    ...createPaymentHandlers({ db, now: () => now, allowScenarios: true }),
  );
  const session = await createReadyBookingSession();
  const booking = await httpBookingRepository.createBooking(
    session.sessionId,
    "booking-key",
  );
  const response = await fetch("/api/v1/payments/vnpay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "payment-key",
    },
    body: JSON.stringify({ bookingId: booking.bookingId }),
  });
  expect(response.status).toBe(201);
  return { storage, now, session, booking, transaction: await response.json() };
}
async function callback(transaction: {
  transactionId: string;
  resultId: string;
}): Promise<Response> {
  return fetch("/api/v1/payments/vnpay/return", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactionId: transaction.transactionId,
      resultId: transaction.resultId,
    }),
  });
}
describe("payment mock snapshot continuity", () => {
  it("restores pending transaction identity/key and original hold without ticket creation", async () => {
    const { storage, now, session, transaction } = await setup();
    const fresh = createMockDb({ storage });
    fresh.hydrate(now + 1000);
    expect(fresh.payments.size).toBe(1);
    expect(fresh.paymentKeys.get("payment-key")).toBe(
      transaction.transactionId,
    );
    expect(fresh.sessions.get(session.sessionId)?.expiresAt).toBe(
      session.expiresAt,
    );
    expect(fresh.holds.size).toBe(2);
    expect(fresh.tickets.size).toBe(0);
  });
  it("restores success after draft/hold completion and repeats callback with identical tickets beyond hold expiry", async () => {
    const { storage, now, session, booking, transaction } = await setup();
    const first = await callback(transaction);
    expect(first.status).toBe(200);
    const result = await first.json();
    const fresh = createMockDb({ storage });
    fresh.hydrate(now + 600001);
    expect(fresh.payments.size).toBe(1);
    expect(fresh.sessions.size).toBe(0);
    expect(fresh.tickets.size).toBe(2);
    expect([...fresh.tickets.values()][0].guestVerification).toEqual({
      email: "test+review@example.invalid",
      phone: "0912345678",
    });
    expect(fresh.paidBookings.has(booking.bookingId)).toBe(true);
    expect(fresh.holds.size).toBe(0);
    expect(
      fresh.seats
        .get(session.tripId)
        ?.filter((s) => session.selectedSeatIds.includes(s.id))
        .map((s) => s.status),
    ).toEqual(["sold", "sold"]);
    server.use(
      ...createPaymentHandlers({ db: fresh, now: () => now + 600001 }),
    );
    expect(await (await callback(transaction)).json()).toEqual(result);
    expect(Object.isFrozen([...fresh.tickets.values()][0].passenger)).toBe(
      true,
    );
    const raw = JSON.parse(storage.getItem(MOCK_BOOKING_STORAGE_KEY) ?? "null");
    expect(JSON.stringify(raw.payments)).not.toMatch(/test\+|0912345678|Khách/);
    expect(raw.sessions).toEqual([]);
    fresh.reset();
    expect(storage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
  });
});

it("keeps paid receipts when an unrelated active draft expires", async () => {
  const { storage, now, transaction } = await setup();
  expect((await callback(transaction)).status).toBe(200);
  await httpBookingRepository.createSession("trip-hcm-dalat-early", 1);
  const fresh = createMockDb({ storage });
  fresh.hydrate(now + 600001);
  expect(fresh.payments.size).toBe(1);
  expect(fresh.tickets.size).toBe(2);
  expect(fresh.sessions.size).toBe(0);
  expect(
    JSON.parse(storage.getItem(MOCK_BOOKING_STORAGE_KEY) ?? "null").sessions,
  ).toEqual([]);
});
it("discards duplicate successful receipt references rather than trusting a second paid transaction", async () => {
  const { storage, now, transaction } = await setup();
  await callback(transaction);
  const raw = JSON.parse(storage.getItem(MOCK_BOOKING_STORAGE_KEY) ?? "null");
  const duplicate = structuredClone(raw.payments[0]);
  duplicate.transaction.transactionId = "other-tx";
  duplicate.transaction.resultId = "other-result";
  duplicate.transaction.returnPath =
    "/payment/vnpay/return?transactionId=other-tx&resultId=other-result";
  duplicate.result = { ...duplicate.result, ...duplicate.transaction };
  raw.payments.push(duplicate);
  raw.paymentKeys.push(["other-key", "other-tx"]);
  storage.setItem(MOCK_BOOKING_STORAGE_KEY, JSON.stringify(raw));
  const fresh = createMockDb({ storage });
  fresh.hydrate(now + 1000);
  expect(fresh.payments.size).toBe(0);
  expect(fresh.tickets.size).toBe(0);
  expect(storage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
});

it.each([
  "proof",
  "trip",
  "fare",
  "missing-ticket",
  "foreign-key",
  "oversize",
  "old",
])("discards %s malformed payment archive safely", async (mode) => {
  const { storage, now, transaction } = await setup();
  await callback(transaction);
  const raw = JSON.parse(storage.getItem(MOCK_BOOKING_STORAGE_KEY) ?? "null");
  if (mode === "proof") raw.tickets[0].guestVerification.phone = "PRIVATE";
  if (mode === "trip") raw.payments[0].transaction.tripId = "foreign";
  if (mode === "fare") raw.tickets[0].fareVnd++;
  if (mode === "missing-ticket") raw.tickets.pop();
  if (mode === "foreign-key")
    raw.paymentKeys.push(["foreign-key", "foreign-id"]);
  if (mode === "oversize") raw.tickets = Array(601).fill(raw.tickets[0]);
  storage.setItem(MOCK_BOOKING_STORAGE_KEY, JSON.stringify(raw));
  const fresh = createMockDb({ storage });
  fresh.hydrate(now + (mode === "old" ? 86400001 : 1000));
  expect(fresh.payments.size).toBe(0);
  expect(fresh.tickets.size).toBe(0);
  expect(storage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
});
