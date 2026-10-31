import { describe, expect, it } from "vitest";
import { selectSchedule, type ScheduleTrip } from "./schedule.schema";

const base: ScheduleTrip = {
  id: "BL-1",
  origin: "TP.HCM",
  destination: "Đà Lạt",
  date: "2026-08-28",
  departure: "11:00",
  arrival: "17:30",
  vehicleLabel: "Giường nằm",
  crew: "Nhân viên",
  passengers: 0,
  capacity: 34,
  status: "scheduled",
  assignment: "complete",
};
const trips = [
  base,
  {
    ...base,
    id: "BL-2",
    departure: "07:30",
    assignment: "conflict" as const,
    status: "draft" as const,
  },
  { ...base, id: "BL-3", origin: "Đà Lạt", departure: "23:15" },
];
describe("Operator schedule selection", () => {
  it("filters the whole collection before pagination without changing the source", () => {
    expect(
      selectSchedule(trips, { assignment: "conflict", status: "draft" }).map(
        (trip) => trip.id,
      ),
    ).toEqual(["BL-2"]);
    expect(trips.map((trip) => trip.id)).toEqual(["BL-1", "BL-2", "BL-3"]);
  });
  it("combines route, date and half-open departure periods", () => {
    expect(
      selectSchedule(trips, {
        origin: "TP.HCM",
        destination: "Đà Lạt",
        date: "2026-08-28",
        period: "morning",
      }),
    ).toHaveLength(2);
    expect(
      selectSchedule(trips, { period: "evening" }).map((trip) => trip.id),
    ).toEqual(["BL-3"]);
    expect(selectSchedule(trips, { date: "2026-08-29" })).toEqual([]);
    expect(
      selectSchedule([{ ...base, departure: "12:00" }], { period: "morning" }),
    ).toEqual([]);
  });
  it("sorts independently from fixture order", () => {
    expect(
      selectSchedule(trips, { sort: "earliest" }).map((trip) => trip.id),
    ).toEqual(["BL-2", "BL-1", "BL-3"]);
    expect(
      selectSchedule(trips, { sort: "latest" }).map((trip) => trip.id),
    ).toEqual(["BL-3", "BL-1", "BL-2"]);
  });
});
