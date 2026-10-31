import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";
import type { BookingSession } from "@/features/booking/types/booking";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { paymentCreateSchema } from "@/features/payment/schemas/payment.schema";
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
async function ready(): Promise<{
  session: BookingSession;
  booking: BookingCreationSummary;
}> {
  const session = await createReadyBookingSession();
  const booking = await httpBookingRepository.createBooking(
    session.sessionId,
    "booking-key",
  );
  return { session, booking };
}
async function post(
  body: unknown,
  key: string | null = "payment-key",
): Promise<Response> {
  return fetch("/api/v1/payments/vnpay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function problem(
  response: Response,
  status: number,
  code: string,
): Promise<void> {
  expect(response.status).toBe(status);
  expect(response.headers.get("Content-Type")).toContain(
    "application/problem+json",
  );
  const body = await response.json();
  expect(body).toMatchObject({
    code,
    instance: "/api/v1/payments/vnpay",
    traceId: expect.any(String),
  });
  expect(JSON.stringify(body)).not.toMatch(/PRIVATE|test\+|0912345678/);
}
describe("VNPay create transaction", () => {
  it("creates one stable opaque transaction for concurrent same-key retries without issuing tickets", async () => {
    const { session, booking } = await ready();
    const responses = await Promise.all([
      post({ bookingId: booking.bookingId, scenario: "success" }),
      post({ bookingId: booking.bookingId, scenario: "success" }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    const [one, two] = await Promise.all(responses.map((r) => r.json()));
    expect(one).toEqual(two);
    expect(paymentCreateSchema.safeParse(one).success).toBe(true);
    expect(one).toMatchObject({
      bookingId: booking.bookingId,
      bookingCode: booking.bookingCode,
      tripId: session.tripId,
      sessionId: session.sessionId,
      amountVnd: session.totalVnd,
      expiresAt: session.expiresAt,
    });
    expect(mockDb.payments.size).toBe(1);
    expect(mockDb.tickets.size).toBe(0);
    expect(mockDb.sessions.get(session.sessionId)?.status).toBe("active");
  });
  it.each([{}, { bookingId: "missing" }])(
    "rejects missing or unknown booking %j",
    async (body) => {
      const response = await post(body);
      await problem(
        response,
        "bookingId" in body ? 404 : 400,
        "bookingId" in body ? "NOT_FOUND" : "VALIDATION_ERROR",
      );
    },
  );
  it("requires an idempotency key and strict body without echoing submitted values", async () => {
    const { booking } = await ready();
    await problem(
      await post({ bookingId: booking.bookingId }, null),
      400,
      "VALIDATION_ERROR",
    );
    await problem(
      await post({ bookingId: booking.bookingId, email: "PRIVATE" }),
      400,
      "VALIDATION_ERROR",
    );
  });
  it("rejects mismatched same-key scenario and another key while transaction remains pending", async () => {
    const { booking } = await ready();
    expect(
      (await post({ bookingId: booking.bookingId, scenario: "success" }))
        .status,
    ).toBe(201);
    await problem(
      await post({ bookingId: booking.bookingId, scenario: "failed" }),
      409,
      "IDEMPOTENCY_CONFLICT",
    );
    await problem(
      await post(
        { bookingId: booking.bookingId, scenario: "success" },
        "another-key",
      ),
      409,
      "PAYMENT_IN_PROGRESS",
    );
  });
  it("preserves original expiry and rejects expired or inconsistent booking total", async () => {
    const { session, booking } = await ready();
    clock = Date.parse(session.expiresAt);
    await problem(
      await post({ bookingId: booking.bookingId }),
      410,
      "HOLD_EXPIRED",
    );
    mockDb.reset();
    clock = Date.now();
    const next = await ready();
    const serverSession = mockDb.sessions.get(next.session.sessionId);
    if (!serverSession) throw new Error("Expected session");
    serverSession.totalVnd = 1;
    await problem(
      await post({ bookingId: next.booking.bookingId }),
      409,
      "PAYMENT_NOT_ALLOWED",
    );
  });
  it("gates failed/pending scenario controls in production while preserving normal pay/cancel", async () => {
    const { booking } = await ready();
    server.use(...createPaymentHandlers({ db: mockDb, allowScenarios: false }));
    await problem(
      await post({ bookingId: booking.bookingId, scenario: "pending" }),
      400,
      "VALIDATION_ERROR",
    );
    await problem(
      await post({ bookingId: booking.bookingId, scenario: "failed" }),
      400,
      "VALIDATION_ERROR",
    );
    expect((await post({ bookingId: booking.bookingId })).status).toBe(201);
  });
});
