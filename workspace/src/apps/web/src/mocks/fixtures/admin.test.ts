import { describe, expect, it } from "vitest";

import {
  adminBookings,
  adminOrganizations,
  adminPayments,
  adminRefunds,
  adminStaff,
} from "./admin";

describe("admin fixtures", () => {
  it("uses stable immutable fictional records", () => {
    expect(adminOrganizations.map(({ id }) => id)).toEqual([
      "ORG-001",
      "ORG-002",
      "ORG-003",
      "ORG-004",
      "ORG-005",
      "ORG-006",
      "ORG-007",
      "ORG-008",
      "ORG-009",
      "ORG-010",
      "org-blue-demo",
      "org-sunrise-demo",
      "org-river-demo",
    ]);
    expect(Object.isFrozen(adminOrganizations)).toBe(true);
    expect(
      [
        ...adminOrganizations,
        ...adminStaff,
        ...adminBookings,
        ...adminPayments,
        ...adminRefunds,
      ].every(Object.isFrozen),
    ).toBe(true);
    expect(JSON.stringify({ adminOrganizations, adminStaff })).toContain(
      ".invalid",
    );
  });

  it("keeps every organization, booking, payment and refund reference valid", () => {
    const organizationIds = new Set(adminOrganizations.map(({ id }) => id));
    const bookings = new Map(adminBookings.map((item) => [item.id, item]));
    const payments = new Map(adminPayments.map((item) => [item.id, item]));

    expect(
      adminStaff.every(({ organizationId, role }) =>
        role === "PLATFORM_SUPPORT"
          ? organizationId === "platform-blue"
          : organizationIds.has(organizationId),
      ),
    ).toBe(true);
    expect(
      adminBookings.every(({ organizationId }) =>
        organizationIds.has(organizationId),
      ),
    ).toBe(true);
    expect(
      adminPayments.every(({ bookingId }) => bookings.has(bookingId)),
    ).toBe(true);
    expect(
      adminRefunds.every(({ bookingId, paymentId }) => {
        const payment = payments.get(paymentId);
        return payment?.bookingId === bookingId;
      }),
    ).toBe(true);
  });
});
