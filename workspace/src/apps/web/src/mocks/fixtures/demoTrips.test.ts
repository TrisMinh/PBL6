import { describe, it, expect } from "vitest";
import { createDemoTrips } from "./demoTrips";
import { trips } from "./trips";
import { createTripHandlers } from "@/mocks/handlers/tripHandlers";
import { createBookingHandlers } from "@/mocks/handlers/bookingHandlers";
import { createMockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";

describe("Customer search demo data", () => {
  it("seeds seven Vietnam service days, preserves overnight arrivals and canonical fixtures", () => {
    const before = JSON.stringify(trips),
      data = createDemoTrips("2026-10-31");
    expect(data).toHaveLength(168);
    expect(new Set(data.map((t) => t.id)).size).toBe(168);
    expect(data[0]).toMatchObject({
      departureTime: "2026-11-01T00:00:00.000Z",
      arrivalTime: "2026-11-01T06:30:00.000Z",
      fareVnd: 320000,
      availableSeatCount: 6,
    });
    expect(data[5]).toMatchObject({
      departureTime: "2026-11-01T15:00:00.000Z",
      arrivalTime: "2026-11-01T21:30:00.000Z",
    });
    expect(data[3]?.fareVnd).toBe(300000);
    expect(data[167]?.id).toContain("2026-11-07");
    expect(JSON.stringify(trips)).toBe(before);
  });
  it("serves 24 demo trips on the selected day and supports starting a booking and loading its seats", async () => {
    const data = createDemoTrips("2098-12-01"),
      first = data[0];
    if (!first) throw Error("Missing seed");
    const db = createMockDb({ trips: [...trips, ...data] });
    server.use(
      ...createTripHandlers([...trips, ...data]),
      ...createBookingHandlers({
        db,
        now: () => Date.parse("2098-12-01T00:00:00Z"),
      }),
    );
    const query = new URLSearchParams({
      originId: "loc-hcm",
      destinationId: "loc-dalat",
      departureDate: "2098-12-02",
      passengerCount: "2",
    });
    const response = await fetch(
      new URL(`/api/v1/trips?${query}`, window.location.origin),
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.total).toBe(24);
    const start = await fetch(
      new URL("/api/v1/booking-sessions", window.location.origin),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "demo-search-booking",
        },
        body: JSON.stringify({ tripId: first.id, passengerCount: 2 }),
      },
    );
    expect(start.status).toBe(201);
    const seats = await fetch(
      new URL(
        `/api/v1/trips/${encodeURIComponent(first.id)}/seats`,
        window.location.origin,
      ),
    );
    expect(seats.status).toBe(200);
    expect((await seats.json()).items.length).toBeGreaterThan(0);
  });
});
