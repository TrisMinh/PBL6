import { beforeEach, describe, expect, it, vi } from "vitest";
import { liveApiJson } from "@/shared/api/liveRequest";
import { createBackendTransactionRepository } from "./backendTransactionRepository";
import { liveTransactionStatus } from "../transactions/liveTransactionStatus";

vi.mock("@/shared/api/liveRequest", () => ({ liveApiJson: vi.fn() }));
const booking = {
  id: "b1",
  code: "REAL-123",
  organizationId: "org2",
  tripId: "t1",
  status: "REFUND_PENDING",
  contact: { fullName: "Customer" },
  items: [{ seatCode: "A1" }],
  total: 200000,
  createdAt: "2026-11-01T00:00:00Z",
};
const payments = [
  {
    id: "p1",
    paymentReference: "PAY-REAL-1",
    bookingId: "b1",
    status: "REFUNDED",
    amount: 200000,
    provider: "SEPAY",
    createdAt: "2026-11-01T00:00:00Z",
  },
  {
    id: "p2",
    paymentReference: "PAY-REAL-2",
    bookingId: "b1",
    status: "FAILED",
    amount: 200000,
    provider: "SEPAY",
  },
];
const refunds = [
  {
    id: "r1",
    refundReference: "REF-REAL-1",
    paymentId: "p1",
    bookingId: "b1",
    status: "SUCCEEDED",
    amount: 100000,
    reason: "OPERATOR_CANCEL",
    createdAt: "2026-11-02T00:00:00Z",
  },
  {
    id: "r2",
    refundReference: "REF-REAL-2",
    paymentId: "p1",
    bookingId: "b1",
    status: "REQUESTED",
    amount: 100000,
    reason: "CUSTOMER_CANCEL",
  },
];
const actualHistory = [
  { occurredAt: "2026-11-02T00:00:00Z", description: "Actual stored event" },
];
beforeEach(() => {
  vi.mocked(liveApiJson)
    .mockReset()
    .mockImplementation(async (path) => {
      const value = String(path);
      if (value.endsWith("/audit"))
        return {
          history: actualHistory,
          seats: ["A01", "B02"],
          partnerCode: "PARTNER-REAL",
          updatedAt: "2026-11-02T00:00:00Z",
          cancellationFee: 10000,
          refundAmount: 190000,
        };
      if (value === "/api/v1/admin/organizations")
        return [{ id: "org2", name: "Actual organization" }];
      if (value.startsWith("/api/v1/admin/bookings?"))
        return {
          items: [
            booking,
            {
              ...booking,
              id: "b2",
              code: "OTHER",
              status: "EXPIRED",
              organizationId: "org1",
            },
          ],
          totalPages: 1,
        };
      if (value.startsWith("/api/v1/admin/payments?"))
        return { items: payments, totalPages: 1 };
      if (value.startsWith("/api/v1/admin/refunds?"))
        return { items: refunds, totalPages: 1 };
      if (value === "/api/v1/bookings/b1/tickets")
        return [{ id: "ticket1", status: "CANCELLED" }];
      if (value === "/api/v1/bookings/b1") return booking;
      if (value === "/api/v1/payments/p1") return payments[0];
      if (value === "/api/v1/refunds/r1") return refunds[0];
      if (value === "/api/v1/trips/t1")
        return {
          origin: "A",
          destination: "B",
          departureAt: "2026-11-10T00:00:00Z",
        };
      throw new Error(`Unexpected API ${value}`);
    });
});
describe("real admin transactions", () => {
  it.each([
    ["bookings", "REFUND_PENDING", "awaiting-refund"],
    ["bookings", "EXPIRED", "expired"],
    ["bookings", "REFUNDED", "refunded"],
    ["payments", "REFUNDED", "refunded"],
    ["payments", "PARTIALLY_REFUNDED", "partially-refunded"],
    ["payments", "REFUND_PENDING", "awaiting-refund"],
    ["refunds", "REQUESTED", "queued"],
  ] as const)("preserves %s %s", (resource, raw, state) => {
    expect(liveTransactionStatus(resource, raw)).toMatchObject({
      state,
      rawStatus: raw,
    });
  });
  it("filters by actual organization, status and searchable code before pagination", async () => {
    const result = await createBackendTransactionRepository().listBookings({
      page: 1,
      pageSize: 1,
      status: "awaiting-refund",
      organizationId: "org2",
      query: "real-123",
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: "b1",
      live: {
        organizationName: "Actual organization",
        state: "awaiting-refund",
      },
    });
    expect(
      (
        await createBackendTransactionRepository().listBookings({
          page: 1,
          pageSize: 1,
          status: "expired",
        })
      ).items[0].id,
    ).toBe("b2");
  });
  it("joins real booking payments, refunds, tickets and stored history", async () => {
    const result = await createBackendTransactionRepository().getBooking("b1");
    expect(result.routeLabel).toBe("A → B");
    expect(result.live).toMatchObject({
      paymentIds: ["p1", "p2"],
      paymentCodes: { p1: "PAY-REAL-1", p2: "PAY-REAL-2" },
      refundCodes: { r1: "REF-REAL-1", r2: "REF-REAL-2" },
      seats: ["A01", "B02"],
      refundIds: ["r1", "r2"],
      collectedVnd: 200000,
      refundedVnd: 100000,
      history: actualHistory,
      cancellationFee: 10000,
    });
    expect(result.audit).toBeUndefined();
  });
  it("shows refunded payment and actual partner reference", async () => {
    const result = await createBackendTransactionRepository().getPayment("p1");
    expect(result.transactionCode).toBe("PAY-REAL-1");
    expect(result.live).toMatchObject({
      state: "refunded",
      provider: "SEPAY",
      partnerCode: "PARTNER-REAL",
      organizationName: "Actual organization",
      refundIds: ["r1", "r2"],
      history: actualHistory,
    });
  });
  it("joins refund reason and original financial records", async () => {
    const result = await createBackendTransactionRepository().getRefund("r1");
    expect(result.refundReference).toBe("REF-REAL-1");
    expect(result.live).toMatchObject({
      state: "completed",
      paymentCode: "PAY-REAL-1",
      reason: "Nhà xe hủy chuyến",
      collectedVnd: 200000,
      refundedVnd: 100000,
      expectedRefundVnd: 190000,
      history: actualHistory,
    });
  });
  it("filters payments/refunds using the real linked organization and booking code", async () => {
    expect(
      (
        await createBackendTransactionRepository().listPayments({
          page: 1,
          pageSize: 20,
          status: "refunded",
          organizationId: "org2",
          query: "REAL-123",
        })
      ).items.map((x) => x.id),
    ).toEqual(["p1"]);
    expect(
      (
        await createBackendTransactionRepository().listRefunds({
          page: 1,
          pageSize: 20,
          status: "queued",
          organizationId: "org2",
        })
      ).items.map((x) => x.id),
    ).toEqual(["r2"]);
  });
});
