import { describe, expect, it } from "vitest";

import { safeIntendedRedirect } from "@/features/auth/lib/intendedRedirect";

describe("canonical intended redirect", () => {
  it.each([
    "/account/tickets",
    "/tickets/BLUE-ABC",
    "/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2",
  ])("allows canonical customer path %s", (path) => {
    expect(safeIntendedRedirect(path, "customer")).toBe(path);
  });
  it("allows the intended admin detail only for admin", () => {
    expect(safeIntendedRedirect("/admin/bookings/booking-1", "admin")).toBe(
      "/admin/bookings/booking-1",
    );
  });
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%2f%2fevil.test",
    "/login",
    "/random",
    "/tickets/BLUE-ABC?token=secret",
    "/account/tickets?email=private",
    "/admin/staff",
  ])("rejects unsafe/unapproved customer path %s", (path) => {
    expect(safeIntendedRedirect(path, "customer")).toBe("/account/tickets");
  });
});
