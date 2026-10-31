import { describe, expect, it } from "vitest";

import {
  paymentCreateSchema,
  paymentResultSchema,
  paymentReturnQuerySchema,
} from "@/features/payment/schemas/payment.schema";

const transaction = {
  tripId: "trip-one",
  bookingCode: "BLUE-BOOK1",
  transactionId: "tx-opaque",
  resultId: "result-opaque",
  bookingId: "booking-one",
  sessionId: "session-one",
  amountVnd: 560000,
  createdAt: "2099-01-01T00:00:00.000Z",
  expiresAt: "2099-01-01T00:10:00.000Z",
  returnPath:
    "/payment/vnpay/return?transactionId=tx-opaque&resultId=result-opaque",
};
const ticket = {
  ticketId: "ticket-one",
  ticketCode: "BLUE-TICKET1",
  bookingId: "booking-one",
  tripId: "trip-one",
  seatId: "trip-one:A01",
  seatCode: "A01",
  fareVnd: 560000,
  status: "issued",
};
const result = { ...transaction, status: "success", tickets: [ticket] };
describe("payment runtime boundary", () => {
  it("parses detached frozen canonical transactions", () => {
    const parsed = paymentCreateSchema.parse(transaction);
    expect(parsed).toEqual(transaction);
    expect(parsed).not.toBe(transaction);
    expect(Object.isFrozen(parsed)).toBe(true);
  });
  it.each([0, -1, 1.2, "560000"])("rejects malformed amount %s", (amountVnd) =>
    expect(
      paymentCreateSchema.safeParse({ ...transaction, amountVnd }).success,
    ).toBe(false),
  );
  it.each([
    "https://evil.invalid/path",
    "/payment/vnpay/return?status=success",
    "/payment/vnpay/return?transactionId=other&resultId=result-opaque",
    "/payment/vnpay/return?transactionId=tx-opaque&resultId=result-opaque&email=test+private@example.invalid",
  ])("rejects untrusted return path %s", (returnPath) =>
    expect(
      paymentCreateSchema.safeParse({ ...transaction, returnPath }).success,
    ).toBe(false),
  );
  it("rejects reversed expiry and non-UTC timestamps", () => {
    expect(
      paymentCreateSchema.safeParse({
        ...transaction,
        expiresAt: transaction.createdAt,
      }).success,
    ).toBe(false);
    expect(
      paymentCreateSchema.safeParse({
        ...transaction,
        createdAt: "2099-01-01T00:00:00+07:00",
      }).success,
    ).toBe(false);
  });
  it("requires exactly issued ticket summaries before success", () => {
    expect(
      paymentResultSchema.safeParse({ ...result, tickets: [] }).success,
    ).toBe(false);
    expect(
      paymentResultSchema.safeParse({ ...result, tickets: [ticket, ticket] })
        .success,
    ).toBe(false);
    expect(
      paymentResultSchema.safeParse({
        ...result,
        tickets: [{ ...ticket, bookingId: "other" }],
      }).success,
    ).toBe(false);
    expect(
      paymentResultSchema.safeParse({
        ...result,
        tickets: [{ ...ticket, fareVnd: 1 }],
      }).success,
    ).toBe(false);
  });
  it.each(["pending", "failed", "cancelled"])(
    "never accepts tickets for %s",
    (status) => {
      expect(paymentResultSchema.safeParse({ ...result, status }).success).toBe(
        false,
      );
      expect(
        paymentResultSchema.safeParse({ ...result, status, tickets: [] })
          .success,
      ).toBe(true);
    },
  );
  it("freezes success summaries and rejects unknown state", () => {
    const parsed = paymentResultSchema.parse(result);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(
      paymentResultSchema.safeParse({ ...result, status: "paid" }).success,
    ).toBe(false);
  });
  it("accepts only two opaque return query identifiers", () => {
    expect(
      paymentReturnQuerySchema.safeParse({
        transactionId: "tx-opaque",
        resultId: "result-opaque",
      }).success,
    ).toBe(true);
    expect(
      paymentReturnQuerySchema.safeParse({
        transactionId: "",
        resultId: "result-opaque",
      }).success,
    ).toBe(false);
    expect(
      paymentReturnQuerySchema.safeParse({
        transactionId: "tx-opaque",
        resultId: "result-opaque",
        status: "success",
      }).success,
    ).toBe(false);
    expect(
      paymentReturnQuerySchema.safeParse({
        transactionId: "test+pii@example.invalid",
        resultId: "result-opaque",
      }).success,
    ).toBe(false);
  });
});
