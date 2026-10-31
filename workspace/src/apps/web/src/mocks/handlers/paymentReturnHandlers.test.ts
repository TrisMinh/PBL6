import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";
import type { BookingSession } from "@/features/booking/types/booking";
import type { PaymentTransaction } from "@/features/payment/types/payment";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { paymentResultSchema } from "@/features/payment/schemas/payment.schema";
import { createPaymentHandlers } from "@/mocks/handlers/paymentHandlers";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { createReadyBookingSession } from "@/test/booking";

let clock = Date.now();
beforeEach(() => {
  clock = Date.now();
  mockDb.reset();
  server.use(
    ...createPaymentHandlers({
      db: mockDb,
      now: () => clock,
      allowScenarios: true,
    }),
  );
});
afterEach(() => mockDb.reset());
async function ready(
  scenario = "success",
  key = "pay-key",
): Promise<{
  session: BookingSession;
  booking: BookingCreationSummary;
  transaction: PaymentTransaction;
}> {
  const session = await createReadyBookingSession();
  const booking = await httpBookingRepository.createBooking(
    session.sessionId,
    "book-key",
  );
  const response = await fetch("/api/v1/payments/vnpay", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ bookingId: booking.bookingId, scenario }),
  });
  return { session, booking, transaction: await response.json() };
}
async function callback(body: unknown): Promise<Response> {
  return fetch("/api/v1/payments/vnpay/return", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function ids(transaction: { transactionId: string; resultId: string }): {
  transactionId: string;
  resultId: string;
} {
  return {
    transactionId: transaction.transactionId,
    resultId: transaction.resultId,
  };
}
describe("VNPay authoritative return", () => {
  it("issues exactly one immutable ticket per seat for double callbacks and replays after original hold expiry", async () => {
    const { session, booking, transaction } = await ready();
    const responses = await Promise.all([
      callback(ids(transaction)),
      callback(ids(transaction)),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const [one, two] = await Promise.all(responses.map((r) => r.json()));
    expect(one).toEqual(two);
    expect(paymentResultSchema.safeParse(one).success).toBe(true);
    expect(one.status).toBe("success");
    expect(one.tickets.map((t: { seatId: string }) => t.seatId)).toEqual(
      session.selectedSeatIds,
    );
    expect(mockDb.tickets.size).toBe(2);
    expect(mockDb.paidBookings.has(booking.bookingId)).toBe(true);
    expect(mockDb.sessions.get(session.sessionId)?.status).toBe("completed");
    expect(mockDb.holds.size).toBe(0);
    for (const ticket of mockDb.tickets.values()) {
      expect(Object.isFrozen(ticket)).toBe(true);
      expect(Object.isFrozen(ticket.passenger)).toBe(true);
      expect(ticket.bookingCode).toBe(booking.bookingCode);
    }
    expect(
      mockDb.seats
        .get(session.tripId)
        ?.filter((s) => session.selectedSeatIds.includes(s.id))
        .map((s) => s.status),
    ).toEqual(["sold", "sold"]);
    clock = Date.parse(session.expiresAt) + 1;
    expect(await (await callback(ids(transaction))).json()).toEqual(one);
    expect(mockDb.tickets.size).toBe(2);
  });
  it.each(["failed", "cancelled", "pending"])(
    "keeps %s free of tickets and preserves original active hold",
    async (scenario) => {
      const { session, transaction } = await ready(scenario);
      const response = await callback(ids(transaction));
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toMatchObject({
        status: scenario,
        tickets: [],
        expiresAt: session.expiresAt,
      });
      expect(mockDb.tickets.size).toBe(0);
      expect(mockDb.sessions.get(session.sessionId)?.status).toBe("active");
      expect(mockDb.holds.size).toBe(2);
      expect(await (await callback(ids(transaction))).json()).toEqual(result);
    },
  );
  it("allows a new attempt after terminal failure but blocks new attempts after success", async () => {
    const { booking, transaction } = await ready("failed");
    await callback(ids(transaction));
    const next = await fetch("/api/v1/payments/vnpay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "next-key",
      },
      body: JSON.stringify({ bookingId: booking.bookingId }),
    });
    expect(next.status).toBe(201);
    const second = await next.json();
    expect(second.transactionId).not.toBe(transaction.transactionId);
    await callback(ids(second));
    const paid = await fetch("/api/v1/payments/vnpay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "third-key",
      },
      body: JSON.stringify({ bookingId: booking.bookingId }),
    });
    expect(paid.status).toBe(409);
    expect((await paid.json()).code).toBe("PAYMENT_NOT_ALLOWED");
    expect(mockDb.tickets.size).toBe(2);
  });
  it("rejects missing/mismatched/extra opaque IDs without echoing values", async () => {
    const { transaction } = await ready();
    for (const [body, status] of [
      [{}, 400],
      [{ ...ids(transaction), status: "success" }, 400],
      [{ ...ids(transaction), resultId: "PRIVATE" }, 404],
      [{ transactionId: "missing", resultId: "missing" }, 404],
    ]) {
      const response = await callback(body);
      expect(response.status).toBe(status);
      expect(response.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      expect(JSON.stringify(await response.json())).not.toMatch(/PRIVATE/);
    }
    expect(mockDb.tickets.size).toBe(0);
  });
  it("expires an unconfirmed callback without selling seats or extending the hold", async () => {
    const { session, transaction } = await ready();
    clock = Date.parse(session.expiresAt);
    const response = await callback(ids(transaction));
    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe("HOLD_EXPIRED");
    expect(mockDb.tickets.size).toBe(0);
    expect(mockDb.holds.size).toBe(0);
    expect(mockDb.sessions.get(session.sessionId)?.expiresAt).toBe(
      session.expiresAt,
    );
  });
});

it("keeps only private normalized guest verification proof while receipt summaries never expose PII", async () => {
  const { transaction } = await ready();
  const response = await callback(ids(transaction));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(JSON.stringify(result)).not.toMatch(
    /test\+review|0912345678|guestVerification|fullName/,
  );
  for (const ticket of mockDb.tickets.values()) {
    expect(ticket.guestVerification).toEqual({
      email: "test+review@example.invalid",
      phone: "0912345678",
    });
    expect(Object.isFrozen(ticket.guestVerification)).toBe(true);
  }
});
