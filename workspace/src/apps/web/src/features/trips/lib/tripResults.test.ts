import { describe, expect, it } from "vitest";

import {
  parseTripSearch,
  selectVisibleTrips,
} from "@/features/trips/lib/tripResults";
import { trips } from "@/mocks/fixtures/trips";

describe("trip results URL/presentation boundary", () => {
  it("parses core through the shared schema and defaults sort", () => {
    expect(
      parseTripSearch(
        new URLSearchParams({
          originId: " loc-hcm ",
          destinationId: "loc-dalat",
          departureDate: "2099-01-01",
          passengerCount: "2",
          vehicleType: "cabin-22",
        }),
      ),
    ).toEqual({
      originId: "loc-hcm",
      destinationId: "loc-dalat",
      departureDate: "2099-01-01",
      passengerCount: 2,
      sort: "relevance",
    });
  });
  it.each([
    "originId",
    "destinationId",
    "departureDate",
    "passengerCount",
    "sort",
  ])("rejects duplicate %s before schema parsing", (key) => {
    const params = new URLSearchParams({
      originId: "loc-hcm",
      destinationId: "loc-dalat",
      departureDate: "2099-01-01",
      passengerCount: "2",
      sort: "departure",
    });
    params.append(key, params.get(key) ?? "");
    expect(parseTripSearch(params)).toBeNull();
  });
  it.each(["relevance", "departure", "price-asc", "price-desc"] as const)(
    "sorts a detached array stably by %s without mutating frozen input",
    (sort) => {
      const source = Object.freeze([
        trips[2],
        trips[0],
        trips[1],
        trips[3],
        Object.freeze({ ...trips[1], id: "tie" }),
      ]);
      const snapshot = JSON.stringify(source);
      const selected = selectVisibleTrips(source, sort);
      const expected =
        sort === "relevance"
          ? [trips[2].id, trips[0].id, trips[1].id, trips[3].id, "tie"]
          : sort === "departure"
            ? [trips[0].id, trips[1].id, "tie", trips[2].id, trips[3].id]
            : sort === "price-asc"
              ? [trips[1].id, "tie", trips[0].id, trips[3].id, trips[2].id]
              : [trips[2].id, trips[3].id, trips[0].id, trips[1].id, "tie"];
      expect(selected.map((trip) => trip.id)).toEqual(expected);
      expect(selected).not.toBe(source);
      expect(JSON.stringify(source)).toBe(snapshot);
    },
  );
  it("filters only valid optional vehicle values on a new array", () => {
    const cabins = selectVisibleTrips(trips, "departure", {
      vehicleType: "cabin-22",
    });
    expect(cabins).toHaveLength(13);
    expect(cabins.every((trip) => trip.vehicleType === "cabin-22")).toBe(true);
    expect(cabins).not.toBe(trips);
    expect(
      selectVisibleTrips(trips, "departure", { vehicleType: "unknown" }),
    ).toHaveLength(trips.length);
  });

  it("applies every enabled filter against the visible presentation contract", () => {
    const firstSix = trips.slice(0, 6);
    const ids = (
      criteria: Parameters<typeof selectVisibleTrips>[2],
    ): string[] =>
      selectVisibleTrips(firstSix, "relevance", criteria).map(
        (trip) => trip.id,
      );

    expect(ids({ vehicleType: "sleeper-34" })).toEqual([
      trips[1].id,
      trips[4].id,
    ]);
    expect(ids({ departurePeriod: "morning" })).toEqual(
      firstSix.slice(0, 4).map((trip) => trip.id),
    );
    expect(ids({ departurePeriod: "afternoon" })).toEqual([trips[4].id]);
    expect(ids({ departurePeriod: "evening" })).toEqual([trips[5].id]);
    expect(ids({ departureHour: "13:00" })).toEqual([trips[4].id, trips[5].id]);
    expect(ids({ minFare: 300_000, maxFare: 340_000 })).toEqual([
      trips[0].id,
      trips[3].id,
    ]);
    expect(ids({ amenities: ["restroom"] })).toEqual([trips[1].id]);
    expect(ids({ amenities: ["wifi", "doorPickup"] })).toEqual([trips[2].id]);
  });
});
