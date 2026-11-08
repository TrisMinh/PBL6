import { describe, expect, it } from "vitest";

import { safeIntendedRedirect } from "@/features/auth/lib/intendedRedirect";

describe("canonical intended redirect", () => {
  it.each([
    "/account/tickets",
    "/trips/019b3000-0000-7000-8000-000000007001/seats",
    "/trips/019b3000-0000-7000-8000-000000007001/seats?passengerCount=2",
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
    "/trips/trip-1/seats?passengerCount=0",
    "/trips/trip-1/seats?passengerCount=1&passengerCount=2",
    "/trips/trip-1/seats?next=https://evil.test",
  ])("rejects unsafe/unapproved customer path %s", (path) => {
    expect(safeIntendedRedirect(path, "customer")).toBe("/account/tickets");
  });
});
