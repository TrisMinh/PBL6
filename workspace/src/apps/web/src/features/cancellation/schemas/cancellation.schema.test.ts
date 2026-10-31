import { describe, expect, it } from "vitest";

import {
  cancellationRequestSchema,
  refundSchema,
} from "@/features/cancellation/schemas/cancellation.schema";

describe("cancellation schemas", () => {
  it("accepts one to six unique ticket ids", () => {
    expect(
      cancellationRequestSchema.safeParse({ ticketIds: ["ticket-1"] }).success,
    ).toBe(true);
    expect(cancellationRequestSchema.safeParse({ ticketIds: [] }).success).toBe(
      false,
    );
    expect(
      cancellationRequestSchema.safeParse({
        ticketIds: ["ticket-1", "ticket-1"],
      }).success,
    ).toBe(false);
    expect(
      cancellationRequestSchema.safeParse({
        ticketIds: Array.from({ length: 7 }, (_, index) => `ticket-${index}`),
      }).success,
    ).toBe(false);
  });

  it("requires a processing refund linked to selected tickets", () => {
    expect(
      refundSchema.safeParse({
        refundId: "refund-1",
        bookingId: "booking-1",
        bookingCode: "BLUE-BOOKING-1",
        ticketIds: ["ticket-1"],
        seatCodes: ["A01"],
        amountVnd: 280000,
        referenceCode: "RF-TEST-1",
        status: "processing",
        createdAt: "2026-10-21T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });
});
