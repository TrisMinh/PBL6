import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

import {
  createTripSearchSchema,
  tripSearchSchema,
} from "@/features/trips/schemas/search.schema";
import type { TripSearch } from "@/features/trips/types/trip";

const validSearch = {
  originId: "loc-hcm",
  destinationId: "loc-dalat",
  departureDate: "2026-10-20",
  passengerCount: 2,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-19T05:00:00Z"));
});

afterEach(() => vi.useRealTimers());

describe("tripSearchSchema", () => {
  it("uses the injected calendar boundary for deterministic parsing", () => {
    const schema = createTripSearchSchema(() => "2026-10-21");
    expect(schema.safeParse(validSearch).success).toBe(false);
    expect(
      schema.safeParse({ ...validSearch, departureDate: "2026-10-21" }).success,
    ).toBe(true);
  });

  it("rechecks the Asia/Ho_Chi_Minh day at each parse across local midnight", () => {
    vi.setSystemTime(new Date("2026-10-19T16:59:59Z"));
    expect(
      tripSearchSchema.safeParse({
        ...validSearch,
        departureDate: "2026-10-19",
      }).success,
    ).toBe(true);
    vi.setSystemTime(new Date("2026-10-19T17:00:00Z"));
    expect(
      tripSearchSchema.safeParse({
        ...validSearch,
        departureDate: "2026-10-19",
      }).success,
    ).toBe(false);
    expect(tripSearchSchema.safeParse(validSearch).success).toBe(true);
  });
  it("parses a valid search and defaults sort to relevance", () => {
    const result = tripSearchSchema.safeParse({
      originId: "loc-hcm",
      destinationId: "loc-dalat",
      departureDate: "2099-01-01",
      passengerCount: 2,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expectTypeOf(result.data).toEqualTypeOf<TripSearch>();
      expect(result.data).toEqual({
        originId: "loc-hcm",
        destinationId: "loc-dalat",
        departureDate: "2099-01-01",
        passengerCount: 2,
        sort: "relevance",
      });
    }
  });

  it.each(["relevance", "departure", "price-asc", "price-desc"])(
    "preserves valid sort %s",
    (sort) => {
      expect(tripSearchSchema.parse({ ...validSearch, sort }).sort).toBe(sort);
    },
  );

  it.each([1, 6])("accepts the passenger boundary %i", (passengerCount) => {
    expect(
      tripSearchSchema.safeParse({ ...validSearch, passengerCount }).success,
    ).toBe(true);
  });

  it("normalizes canonical URL values without retaining unknown fields", () => {
    const result = tripSearchSchema.safeParse({
      originId: " loc-hcm ",
      destinationId: " loc-dalat ",
      departureDate: " 2026-10-20 ",
      passengerCount: " 2 ",
      unexpected: "discard",
    });
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data).toEqual({
        originId: "loc-hcm",
        destinationId: "loc-dalat",
        departureDate: "2026-10-20",
        passengerCount: 2,
        sort: "relevance",
      });
  });

  it.each(["loc-hcm", " loc-hcm "])(
    "rejects the same route after trimming %s",
    (destinationId) => {
      const result = tripSearchSchema.safeParse({
        ...validSearch,
        destinationId,
      });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({ path: ["destinationId"] }),
        );
    },
  );

  it.each(["originId", "destinationId"])(
    "rejects an empty or whitespace-only %s",
    (field) => {
      for (const value of ["", "   "])
        expect(
          tripSearchSchema.safeParse({ ...validSearch, [field]: value })
            .success,
        ).toBe(false);
    },
  );

  it("rejects a past departure date at the date field", () => {
    const result = tripSearchSchema.safeParse({
      ...validSearch,
      departureDate: "2026-10-18",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["departureDate"] }),
      );
  });

  it.each(["2026-10-19", "2028-02-29"])(
    "accepts today or a real future leap date %s",
    (departureDate) => {
      expect(
        tripSearchSchema.safeParse({ ...validSearch, departureDate }).success,
      ).toBe(true);
    },
  );

  it.each([
    "2026-02-30",
    "2027-02-29",
    "2026-2-09",
    "2026-13-01",
    "2026-10-20T00:00:00Z",
    "20/10/2026",
    "",
    null,
    20261020,
  ])("rejects malformed calendar date %s", (departureDate) => {
    expect(
      tripSearchSchema.safeParse({ ...validSearch, departureDate }).success,
    ).toBe(false);
  });

  it.each([
    0,
    7,
    -1,
    1.5,
    NaN,
    Infinity,
    "",
    "0",
    "7",
    "1.5",
    "1e0",
    "0x1",
    "01",
    true,
    false,
    null,
    undefined,
    [],
  ])("rejects invalid passenger count %s", (passengerCount) => {
    expect(
      tripSearchSchema.safeParse({ ...validSearch, passengerCount }).success,
    ).toBe(false);
  });

  it.each(["unknown", "", null])(
    "rejects invalid sort %s instead of silently defaulting",
    (sort) => {
      expect(tripSearchSchema.safeParse({ ...validSearch, sort }).success).toBe(
        false,
      );
    },
  );

  it.each([null, undefined, [], "invalid", {}])(
    "safely rejects an incomplete search %s",
    (input) => {
      expect(tripSearchSchema.safeParse(input).success).toBe(false);
    },
  );
});
