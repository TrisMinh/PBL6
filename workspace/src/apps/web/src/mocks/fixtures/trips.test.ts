import { describe, expect, it } from "vitest";
import { z } from "zod";

import { locations } from "@/mocks/fixtures/locations";
import { operators } from "@/mocks/fixtures/operators";
import { seatLayouts } from "@/mocks/fixtures/seats";
import { trips } from "@/mocks/fixtures/trips";

function getVietnamServiceDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

describe("trip discovery fixtures", () => {
  it("provides the four canonical location IDs with usable labels", () => {
    expect(locations.length).toBeGreaterThanOrEqual(4);
    expect(locations.map((location) => location.id)).toEqual(
      expect.arrayContaining([
        "loc-hcm",
        "loc-danang",
        "loc-dalat",
        "loc-hanoi",
      ]),
    );
    for (const location of locations) {
      expect(location.name.trim()).not.toBe("");
      expect(location.displayName.trim()).not.toBe("");
      expect(location.province.trim()).not.toBe("");
    }
  });

  it("provides fictional operators without external brand assets", () => {
    expect(operators.map((operator) => operator.name)).toEqual([
      "BLUE Express",
      "Sao Mai",
      "Đường Việt",
      "Hành Trình Xanh",
      "Cao Nguyên",
      "Đồi Xanh",
    ]);
    for (const operator of operators)
      expect(Object.keys(operator).sort()).toEqual(["id", "name"]);
  });

  it("has unique stable IDs within each fixture collection", () => {
    for (const collection of [locations, operators, trips]) {
      const ids = collection.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => id.trim().length > 0)).toBe(true);
    }
  });

  it("provides six trips referencing canonical location and operator objects", () => {
    expect(trips.length).toBeGreaterThanOrEqual(6);
    for (const trip of trips) {
      expect(locations.find((location) => location.id === trip.origin.id)).toBe(
        trip.origin,
      );
      expect(
        locations.find((location) => location.id === trip.destination.id),
      ).toBe(trip.destination);
      expect(
        operators.find((operator) => operator.id === trip.operator.id),
      ).toBe(trip.operator);
      expect(trip.origin.id).not.toBe(trip.destination.id);
    }
  });

  it("provides 24 unique deterministic results for the canonical Task2 route and date", () => {
    const canonical = trips.filter(
      (trip) =>
        trip.origin.id === "loc-hcm" &&
        trip.destination.id === "loc-dalat" &&
        getVietnamServiceDate(trip.departureTime) === "2099-01-01",
    );
    expect(canonical).toHaveLength(24);
    expect(new Set(canonical.map((trip) => trip.id)).size).toBe(24);
    expect(
      canonical.slice(0, 6).every((trip) => trip.availableSeatCount > 0),
    ).toBe(true);
    expect(canonical.slice(0, 2)).toMatchObject([
      {
        id: "trip-hcm-dalat-early",
        operator: { id: "op-blue-express" },
        departureTime: "2099-01-01T00:00:00Z",
        arrivalTime: "2099-01-01T06:30:00Z",
        fareVnd: 320_000,
        availableSeatCount: 6,
        vehicleType: "cabin-22",
      },
      {
        id: "trip-hcm-dalat-cabin",
        operator: { id: "op-sao-mai" },
        departureTime: "2099-01-01T01:00:00Z",
        arrivalTime: "2099-01-01T07:15:00Z",
        fareVnd: 280_000,
        availableSeatCount: 12,
        vehicleType: "sleeper-34",
      },
    ]);
    expect(
      canonical.slice(0, 6).map((trip) => ({
        operator: trip.displayOperatorName,
        vehicle: trip.vehicleLabel,
        departure: trip.departureTime,
        arrival: trip.arrivalTime,
        origin: trip.originStopName,
        destination: trip.destinationStopName,
        seats: trip.availableSeatCount,
        fare: trip.fareVnd,
      })),
    ).toEqual([
      {
        operator: "BLUE Expres.",
        vehicle: "Limousine 11 chỗ",
        departure: "2099-01-01T00:00:00Z",
        arrival: "2099-01-01T06:30:00Z",
        origin: "Miền Đông mới",
        destination: "Bến xe Đà Lạt",
        seats: 6,
        fare: 320_000,
      },
      {
        operator: "An Lạc",
        vehicle: "Giường nằm 40 chỗ",
        departure: "2099-01-01T01:00:00Z",
        arrival: "2099-01-01T07:15:00Z",
        origin: "Miền Đông mới",
        destination: "Bến xe Đà Lạt",
        seats: 12,
        fare: 280_000,
      },
      {
        operator: "Thiên Việt",
        vehicle: "Cabin 24 phòng",
        departure: "2099-01-01T02:30:00Z",
        arrival: "2099-01-01T08:45:00Z",
        origin: "Bến xe Q.5",
        destination: "Trung tâm Đà Lạt",
        seats: 4,
        fare: 390_000,
      },
      {
        operator: "Minh Châu",
        vehicle: "Limousine 24 chỗ",
        departure: "2099-01-01T04:00:00Z",
        arrival: "2099-01-01T10:20:00Z",
        origin: "Miền Đông mới",
        destination: "Bến xe Đà Lạt",
        seats: 9,
        fare: 330_000,
      },
      {
        operator: "Cao Nguyên",
        vehicle: "Limousine giường 34",
        departure: "2099-01-01T06:30:00Z",
        arrival: "2099-01-01T13:00:00Z",
        origin: "Bến xe An Sương",
        destination: "Bến xe Đà Lạt",
        seats: 15,
        fare: 275_000,
      },
      {
        operator: "Đồi Xanh",
        vehicle: "Giường phòng 21",
        departure: "2099-01-01T15:00:00Z",
        arrival: "2099-01-01T21:30:00Z",
        origin: "Miền Đông mới",
        destination: "Trung tâm Đà Lạt",
        seats: 7,
        fare: 350_000,
      },
    ]);
  });

  it("covers both vehicle types, multiple fares/times and a sold-out trip", () => {
    expect(new Set(trips.map((trip) => trip.vehicleType))).toEqual(
      new Set(["sleeper-34", "cabin-22"]),
    );
    expect(new Set(trips.map((trip) => trip.fareVnd)).size).toBeGreaterThan(1);
    expect(
      new Set(trips.map((trip) => trip.departureTime)).size,
    ).toBeGreaterThan(1);
    expect(trips.some((trip) => trip.availableSeatCount === 0)).toBe(true);
    expect(trips.some((trip) => trip.availableSeatCount > 0)).toBe(true);
    for (const trip of trips) {
      expect(Number.isInteger(trip.fareVnd)).toBe(true);
      expect(trip.fareVnd).toBeGreaterThan(0);
      expect(Number.isInteger(trip.availableSeatCount)).toBe(true);
      expect(trip.availableSeatCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("never advertises more seats than the physical vehicle layout can expose", () => {
    for (const trip of trips) {
      const physicalCapacity = seatLayouts[trip.vehicleType].filter(
        (seat) => seat.status === "available",
      ).length;
      expect(trip.availableSeatCount).toBeLessThanOrEqual(physicalCapacity);
    }
  });

  it("uses ISO UTC timestamps and deterministic Vietnam service dates", () => {
    for (const trip of trips) {
      expect(z.iso.datetime().safeParse(trip.departureTime).success).toBe(true);
      expect(z.iso.datetime().safeParse(trip.arrivalTime).success).toBe(true);
      expect(trip.departureTime).toMatch(/Z$/);
      expect(trip.arrivalTime).toMatch(/Z$/);
      expect(Date.parse(trip.arrivalTime)).toBeGreaterThan(
        Date.parse(trip.departureTime),
      );
      expect(["2099-01-01", "2099-01-02"]).toContain(
        getVietnamServiceDate(trip.departureTime),
      );
    }
    const earlyTrip = trips.find((trip) => trip.id === "trip-hcm-dalat-early");
    expect(earlyTrip).toBeDefined();
    if (!earlyTrip) throw new Error("Missing early fixture");
    expect(earlyTrip.departureTime).toBe("2099-01-01T00:00:00Z");
    expect(getVietnamServiceDate(earlyTrip.departureTime)).toBe("2099-01-01");
    expect(
      new Set(trips.map((trip) => getVietnamServiceDate(trip.departureTime))),
    ).toEqual(new Set(["2099-01-01", "2099-01-02"]));
  });

  it("exports frozen arrays and records so shared fixture data cannot be mutated", () => {
    for (const collection of [locations, operators, trips]) {
      expect(Object.isFrozen(collection)).toBe(true);
      expect(collection.every((record) => Object.isFrozen(record))).toBe(true);
      expect(Reflect.set(collection, "0", {})).toBe(false);
    }
    const trip = trips[0];
    expect(trip).toBeDefined();
    if (!trip) throw new Error("Missing fixture");
    expect(Reflect.set(trip, "fareVnd", 1)).toBe(false);
    expect(Reflect.set(trip.origin, "name", "changed")).toBe(false);
    expect(Reflect.set(trip.destination, "name", "changed")).toBe(false);
    expect(Reflect.set(trip.operator, "name", "changed")).toBe(false);
  });
});
