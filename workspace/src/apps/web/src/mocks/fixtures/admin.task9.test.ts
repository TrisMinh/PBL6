import { describe, expect, it } from "vitest";
import { adminBookings, adminPayments, adminRefunds } from "./admin";
import {
  adminBookingSchema,
  adminPaymentSchema,
  adminRefundSchema,
} from "@/features/admin/schemas/adminResponse.schema";

describe("Task 9 canonical transaction fixtures", () => {
  for (let suffix = 18; suffix <= 27; suffix++) {
    const code = `260916-0${suffix}`;
    it(`owns booking BK-${code} and its truthful payment`, () => {
      const booking = adminBookings.find((item) => item.id === `BK-${code}`);
      const payment = adminPayments.find((item) => item.id === `PAY-${code}`);
      expect(booking, "exact Figma booking must exist").toBeDefined();
      expect(payment, "exact Figma payment must exist").toBeDefined();
      expect(adminBookingSchema.safeParse(booking).success).toBe(true);
      expect(adminPaymentSchema.safeParse(payment).success).toBe(true);
      expect(payment?.bookingId).toBe(booking?.id);
      expect(payment?.amountVnd).toBe(booking?.totalVnd);
    });
  }
  for (const suffix of [18, 20, 22, 23, 25, 26]) {
    const code = `260916-0${suffix}`;
    it(`owns refund RF-${code} and both source records`, () => {
      const refund = adminRefunds.find((item) => item.id === `RF-${code}`);
      expect(refund, "exact Figma refund must exist").toBeDefined();
      expect(adminRefundSchema.safeParse(refund).success).toBe(true);
      expect(refund?.bookingId).toBe(`BK-${code}`);
      expect(refund?.paymentId).toBe(`PAY-${code}`);
      const source = adminPayments.find(
        (item) => item.id === refund?.paymentId,
      );
      expect(source).toBeDefined();
      expect(refund?.amountVnd).toBeLessThanOrEqual(source?.amountVnd ?? -1);
    });
  }
  it("keeps original collection outcomes independent of refund presentation", () => {
    for (const suffix of [18, 20, 22, 23, 25, 26]) {
      expect(
        adminPayments.find((item) => item.id === `PAY-260916-0${suffix}`)
          ?.status,
      ).toBe("success");
    }
    expect(
      adminPayments.find((item) => item.id === "PAY-260916-021")?.status,
    ).toBe("pending");
    expect(
      adminPayments.find((item) => item.id === "PAY-260916-024")?.status,
    ).toBe("failed");
  });
  it("models expiry and queued transfers without widening API enums", () => {
    const expired = adminBookings.find((item) => item.id === "BK-260916-024");
    const queued = adminRefunds.find((item) => item.id === "RF-260916-025");
    expect(expired?.status).toBe("pending-payment");
    expect(expired?.audit?.reservationState).toBe("expired");
    expect(queued?.status).toBe("processing");
    expect(queued?.audit?.transferState).toBe("queued");
    expect(
      adminBookingSchema.safeParse({ ...expired, status: "expired" }).success,
    ).toBe(false);
    expect(
      adminRefundSchema.safeParse({ ...queued, status: "queued" }).success,
    ).toBe(false);
    expect(
      adminBookingSchema.safeParse({
        ...expired,
        audit: { ...expired?.audit, unexpected: true },
      }).success,
    ).toBe(false);
  });
});
