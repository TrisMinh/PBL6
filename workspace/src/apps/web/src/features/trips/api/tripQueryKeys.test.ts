import { describe, expect, it } from "vitest";

import { tripKeys } from "@/features/trips/api/tripQueryKeys";
import type { TripSearch } from "@/features/trips/types/trip";

const SEARCH: TripSearch = {
  originId: "loc-hcm",
  destinationId: "loc-dalat",
  departureDate: "2099-01-01",
  passengerCount: 2,
  sort: "departure",
};

describe("trip query keys", () => {
  it("namespaces locations separately from searches", () => {
    expect(tripKeys.locations()).toEqual(["trips", "locations"]);
    expect(tripKeys.search(SEARCH)).toEqual(["trips", "search", SEARCH]);
  });

  it("has canonical field order and ignores fields outside the input contract", () => {
    const reordered = {
      sort: SEARCH.sort,
      passengerCount: 2,
      departureDate: SEARCH.departureDate,
      destinationId: SEARCH.destinationId,
      originId: SEARCH.originId,
      scenario: "error",
    };
    expect(tripKeys.search(reordered)).toEqual(tripKeys.search(SEARCH));
    expect(JSON.stringify(tripKeys.search(reordered))).toBe(
      JSON.stringify(tripKeys.search(SEARCH)),
    );
  });

  it("detaches and freezes its input snapshot and tuple", () => {
    const input = { ...SEARCH };
    const key = tripKeys.search(input);
    input.originId = "caller-mutation";
    expect(key).toEqual(["trips", "search", SEARCH]);
    expect(Object.isFrozen(key)).toBe(true);
    expect(Object.isFrozen(key[2])).toBe(true);
    expect(Object.isFrozen(tripKeys.locations())).toBe(true);
    expect(Reflect.set(key, 0, "changed")).toBe(false);
  });

  it.each<[keyof TripSearch, string | number]>([
    ["originId", "other-origin"],
    ["destinationId", "other-destination"],
    ["departureDate", "2099-01-02"],
    ["passengerCount", 3],
    ["sort", "price-desc"],
  ])("includes %s in cache identity", (field, value) => {
    expect(tripKeys.search({ ...SEARCH, [field]: value })).not.toEqual(
      tripKeys.search(SEARCH),
    );
  });
});
