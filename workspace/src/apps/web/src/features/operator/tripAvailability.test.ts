import { describe, expect, it } from "vitest";
import {
  localTripWindow,
  scheduleConflicts,
  type ScheduleTrip,
} from "./tripAvailability";

const trip: ScheduleTrip = {
  id: "other",
  busId: "bus",
  driverId: "driver",
  departureAt: "2027-03-24T01:00:00Z",
  arrivalAt: "2027-03-24T04:00:00Z",
  status: "SCHEDULED",
};
const at = (from: string, to: string): [number, number] => [
  Date.parse(from),
  Date.parse(to),
];

describe("operator availability from trip schedules", () => {
  it("converts Vietnam input, supports overnight trips and waits for a valid interval", () => {
    expect(localTripWindow("2027-03-24T08:00", "2027-03-24T11:00")).toEqual(
      at(trip.departureAt, trip.arrivalAt),
    );
    expect(
      localTripWindow("2027-03-24T23:00", "2027-03-25T02:00"),
    ).not.toBeNull();
    expect(localTripWindow("", "2027-03-25T02:00")).toBeNull();
    expect(localTripWindow("invalid", "invalid")).toBeNull();
    expect(localTripWindow("2027-03-24T08:00", "2027-03-24T08:00")).toBeNull();
  });
  it("checks both buffered half-open windows, including overlap only in the buffers", () => {
    const touching = scheduleConflicts(
      [trip],
      at("2027-03-24T06:00:00Z", "2027-03-24T09:00:00Z"),
    );
    expect(touching.buses.size).toBe(0);
    expect(touching.drivers.size).toBe(0);
    const buffered = scheduleConflicts(
      [trip],
      at("2027-03-24T05:59:00Z", "2027-03-24T09:00:00Z"),
    );
    expect(buffered.buses.has("bus")).toBe(true);
    expect(buffered.drivers.has("driver")).toBe(true);
  });
  it("excludes the trip being edited and other unreserved drafts", () => {
    const interval = at(trip.departureAt, trip.arrivalAt);
    expect(scheduleConflicts([trip], interval, trip.id).buses.size).toBe(0);
    expect(
      scheduleConflicts([{ ...trip, status: "DRAFT" }], interval).drivers.size,
    ).toBe(0);
  });
  it("matches different bus and driver reservation rules", () => {
    const interval = at(trip.departureAt, trip.arrivalAt);
    for (const status of ["CANCELLED", "COMPLETED"]) {
      const conflicts = scheduleConflicts([{ ...trip, status }], interval);
      expect(conflicts.buses.size).toBe(0);
      // A non-null driverId represents an assignment still ACTIVE in operator SQL.
      expect(conflicts.drivers.has("driver")).toBe(true);
    }
    expect(
      scheduleConflicts([{ ...trip, status: "ARRIVED" }], interval).buses.has(
        "bus",
      ),
    ).toBe(true);
  });
  it("does not pretend to know driver availability when assignments are missing", () => {
    const result = scheduleConflicts(
      [{ ...trip, driverId: null }],
      at(trip.departureAt, trip.arrivalAt),
    );
    expect(result.incompleteDrivers).toBe(true);
    expect(result.drivers.size).toBe(0);
    expect(result.buses.has("bus")).toBe(true);
  });
});
