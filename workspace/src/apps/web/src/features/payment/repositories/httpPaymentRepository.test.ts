import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";
import { httpPaymentRepository } from "@/features/payment/repositories/httpPaymentRepository";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { createReadyBookingSession } from "@/test/booking";

afterEach(() => mockDb.reset());
async function ready(): Promise<BookingCreationSummary> {
  const session = await createReadyBookingSession();
  return httpBookingRepository.createBooking(session.sessionId, "booking-key");
}
describe("payment repository HTTP boundary", () => {
  it("sends only body booking/scenario and stable header then parses frozen create/result", async () => {
    const booking = await ready();
    let body: unknown,
      key: string | null = null;
    server.use(
      http.post("/api/v1/payments/vnpay", async ({ request }) => {
        body = await request.clone().json();
        key = request.headers.get("Idempotency-Key");
        return undefined;
      }),
    );
    const transaction = await httpPaymentRepository.create(booking.bookingId, {
      key: "payment-key",
      scenario: "success",
    });
    expect(body).toEqual({ bookingId: booking.bookingId });
    expect(key).toBe("payment-key");
    expect(Object.isFrozen(transaction)).toBe(true);
    const result = await httpPaymentRepository.resolve(
      transaction.transactionId,
      transaction.resultId,
    );
    expect(result.status).toBe("success");
    expect(result.tickets).toHaveLength(2);
    expect(Object.isFrozen(result.tickets[0])).toBe(true);
  });
  it.each(["create", "resolve"])("forwards abort for %s", async (method) => {
    const booking = await ready();
    const controller = new AbortController();
    controller.abort();
    const request =
      method === "create"
        ? httpPaymentRepository.create(
            booking.bookingId,
            { key: "key", scenario: "success" },
            controller.signal,
          )
        : httpPaymentRepository.resolve("tx", "result", controller.signal);
    await expect(request).rejects.toMatchObject({ code: "ABORTED", status: 0 });
  });
  it("normalizes Problem Details without exposing raw server strings", async () => {
    server.use(
      http.post("/api/v1/payments/vnpay", () =>
        HttpResponse.json(
          { code: "PAYMENT_IN_PROGRESS", detail: "PRIVATE" },
          { status: 409 },
        ),
      ),
    );
    await expect(
      httpPaymentRepository.create("booking", {
        key: "key",
        scenario: "success",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_IN_PROGRESS", status: 409 });
    try {
      await httpPaymentRepository.create("booking", {
        key: "key",
        scenario: "success",
      });
    } catch (error) {
      expect(String(error)).not.toContain("PRIVATE");
    }
  });
  it.each(["json", "shape", "wrong-id", "wrong-status"])(
    "rejects %s create response drift",
    async (mode) => {
      const booking = await ready();
      const original = await httpPaymentRepository.create(booking.bookingId, {
        key: "key",
        scenario: "success",
      });
      server.use(
        http.post("/api/v1/payments/vnpay", () =>
          mode === "json"
            ? new HttpResponse("{", { status: 201 })
            : HttpResponse.json(
                mode === "shape"
                  ? { ...original, amountVnd: 1.5 }
                  : mode === "wrong-id"
                    ? { ...original, bookingId: "other" }
                    : original,
                { status: mode === "wrong-status" ? 200 : 201 },
              ),
        ),
      );
      await expect(
        httpPaymentRepository.create(booking.bookingId, {
          key: "key",
          scenario: "success",
        }),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    },
  );
  it("rejects return ID mismatch and malformed result before consumers see success", async () => {
    const booking = await ready();
    const tx = await httpPaymentRepository.create(booking.bookingId, {
      key: "key",
      scenario: "success",
    });
    const result = await httpPaymentRepository.resolve(
      tx.transactionId,
      tx.resultId,
    );
    server.use(
      http.post("/api/v1/payments/vnpay/return", () =>
        HttpResponse.json({ ...result, resultId: "foreign" }),
      ),
    );
    await expect(
      httpPaymentRepository.resolve(tx.transactionId, tx.resultId),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    server.use(
      http.post("/api/v1/payments/vnpay/return", () =>
        HttpResponse.json({ ...result, tickets: [] }),
      ),
    );
    await expect(
      httpPaymentRepository.resolve(tx.transactionId, tx.resultId),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("fails invalid request IDs/key before network and never constructs a query from PII", async () => {
    let calls = 0;
    server.use(
      http.post("/api/v1/payments/vnpay", () => {
        calls++;
        return HttpResponse.json({});
      }),
    );
    await expect(
      httpPaymentRepository.create("test+private@example.invalid", {
        key: "key",
        scenario: "success",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      httpPaymentRepository.create("booking", {
        key: "bad key",
        scenario: "success",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(calls).toBe(0);
  });
});
