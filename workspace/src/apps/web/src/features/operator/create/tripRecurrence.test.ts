import { expect, it } from "vitest";
import { recurrenceEndLimit, recurringDates } from "./RecurringTrips";
it("limits recurrence by three calendar months including month ends", () => {
  expect(recurrenceEndLimit("2027-01-31")).toBe("2027-04-30");
  expect(recurrenceEndLimit("2027-11-30")).toBe("2028-02-29");
  expect(recurrenceEndLimit("")).toBe("");
  const recurrence = { enabled: true, days: [0, 1, 2, 3, 4, 5, 6], endDate: "2027-04-30" };
  expect(recurringDates("2027-01-31", recurrence)).toHaveLength(90);
  expect(recurringDates("2027-01-31", { ...recurrence, endDate: "2027-05-01" })).toEqual([]);
});
