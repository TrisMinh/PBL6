import { expect, it } from "vitest";
import {
  suggestedArrival,
  durationLabel,
  timingError,
  routeTiming,
} from "./tripTiming";
it("suggests next-day arrival in Vietnam time and rejects incomplete clocks", () => {
  expect(suggestedArrival("2026-11-23T21:00", 720)).toBe("2026-11-24T09:00");
  expect(suggestedArrival("2026-11-23T29:00", 720)).toBe("");
  expect(suggestedArrival("2026-11-23T21:", 720)).toBe("");
});
it("rejects past departures and reversed time while allowing historical read/edit checks", () => {
  const now = Date.parse("2026-11-17T06:00:00Z");
  expect(
    timingError("2026-11-07T23:00", "2026-11-28T12:00", true, now),
  ).toContain("đã qua");
  expect(
    timingError("2026-11-23T21:00", "2026-11-23T09:00", true, now),
  ).toContain("sau giờ");
  expect(timingError("2026-11-23T21:00", "2026-11-24T09:00", true, now)).toBe(
    "",
  );
  expect(timingError("2026-11-07T23:00", "2026-11-08T12:00", false, now)).toBe(
    "",
  );
});
it("formats long durations without a cramped hundreds-of-hours label", () => {
  expect(durationLabel(493 * 60)).toBe("20 ngày 13 giờ");
  expect(durationLabel(720)).toBe("12 giờ");
  expect(durationLabel(0)).toBe("Chưa xác định");
});

it("fills a future departure and route-based overnight arrival on route selection", () => {
  const result = routeTiming(
    { departureAt: "", arrivalAt: "" },
    720,
    { departure: false, arrival: false },
    Date.parse("2026-11-17T16:15:00Z"),
  );
  expect(result).toEqual({
    departureAt: "2026-11-18T00:00",
    arrivalAt: "2026-11-18T12:00",
  });
});
it("updates only automatic arrival when changing route duration", () => {
  const times = {
    departureAt: "2026-11-23T21:00",
    arrivalAt: "2026-11-24T09:00",
  };
  expect(routeTiming(times, 1080, { departure: true, arrival: false })).toEqual(
    { ...times, arrivalAt: "2026-11-24T15:00" },
  );
  expect(routeTiming(times, 1080, { departure: true, arrival: true })).toEqual(
    times,
  );
  expect(
    routeTiming({ departureAt: "", arrivalAt: "" }, 1080, {
      departure: true,
      arrival: true,
    }),
  ).toEqual({ departureAt: "", arrivalAt: "" });
});
