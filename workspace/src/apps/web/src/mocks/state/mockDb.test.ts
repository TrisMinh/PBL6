import { describe, expect, it } from "vitest";

import { seatLayouts } from "@/mocks/fixtures/seats";
import { trips } from "@/mocks/fixtures/trips";
import { createMockDb } from "@/mocks/state/mockDb";

describe("mockDb", () => {
  it("deep-clones canonical trip/layout seed data without shared nested references", () => {
    const db = createMockDb();
    expect(db.trips).toEqual(trips);
    expect(db.trips[0]?.origin).not.toBe(trips[0]?.origin);
    expect(db.trips[0]?.operator).not.toBe(trips[0]?.operator);
    const seats = db.seats.get("trip-hcm-dalat-early");
    expect(seats).toHaveLength(22);
    expect(seats?.[0]).not.toBe(seatLayouts["cabin-22"][0]);
  });

  it("derives distinct stable per-trip seat IDs and availability consistent with trip discovery", () => {
    const db = createMockDb();
    expect(db.seats.size).toBe(trips.length);
    const allIds: string[] = [];
    for (const trip of trips) {
      const seats = db.seats.get(trip.id) ?? [];
      expect(seats).toHaveLength(trip.vehicleType === "sleeper-34" ? 34 : 22);
      expect(seats.filter((seat) => seat.status === "available")).toHaveLength(
        trip.availableSeatCount,
      );
      allIds.push(...seats.map((seat) => seat.id));
    }
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("reset removes mutations/sessions/ownership/idempotency and restores fresh isolated clones", () => {
    const db = createMockDb();
    expect(db.trips).toHaveLength(trips.length);
    const original = db.trips[0];
    if (!original) throw new Error("Expected canonical trip");
    original.origin.name = "Mutated mock";
    db.seats.get(original.id)?.forEach((seat) => {
      seat.status = "sold";
    });
    db.sessions.set("test-session", {
      passengerCount: 2,
      sessionId: "test-session",
      tripId: original.id,
      selectedSeatIds: [],
      passengers: [],
      expiresAt: "2099-01-01T00:00:00Z",
      totalVnd: 0,
      status: "active",
    });
    db.holds.set("test-seat", "test-session");
    db.sessionKeys.set("test-key", "test-session");
    db.reset();
    expect(db.trips).toEqual(trips);
    expect(db.trips[0]).not.toBe(original);
    expect(db.trips[0]?.origin.name).toBe(trips[0]?.origin.name);
    expect(
      db.seats.get(original.id)?.filter((seat) => seat.status === "available"),
    ).toHaveLength(original.availableSeatCount);
    expect([db.sessions.size, db.holds.size, db.sessionKeys.size]).toEqual([
      0, 0, 0,
    ]);
  });

  it("separate factory instances do not leak mutations", () => {
    const first = createMockDb();
    const second = createMockDb();
    expect(first.seats.size).toBe(trips.length);
    first.seats.clear();
    first.trips.splice(0);
    expect(second.seats.size).toBe(trips.length);
    expect(second.trips).toEqual(trips);
  });
});
