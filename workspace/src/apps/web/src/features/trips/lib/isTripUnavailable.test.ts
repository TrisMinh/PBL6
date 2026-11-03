import { expect, it } from "vitest";
import { isTripUnavailable } from "./isTripUnavailable";

it.each(["SCHEDULED", "BOARDING"])("accepts open %s trips", (status) => {
  expect(isTripUnavailable({ sellable: true, status })).toBe(false);
});
it.each([
  "DRAFT",
  "CANCELLED",
  "DEPARTED",
  "IN_TRANSIT",
  "ARRIVED",
  "COMPLETED",
  "UNKNOWN",
])("blocks %s even with a stale sellable flag", (status) => {
  expect(isTripUnavailable({ sellable: true, status })).toBe(true);
});
it("blocks closed sales and supports existing mock contracts", () => {
  expect(isTripUnavailable({ sellable: false, status: "SCHEDULED" })).toBe(
    true,
  );
  expect(isTripUnavailable({})).toBe(false);
});
