import { describe, expect, it } from "vitest";

import { seatLayouts } from "@/mocks/fixtures/seats";

describe("immutable seat layouts", () => {
  it.each([
    ["sleeper-34", 34, 17],
    ["cabin-22", 22, 11],
  ] as const)(
    "%s has stable unique codes and two complete decks",
    (vehicle, total, perDeck) => {
      const seats = seatLayouts[vehicle];
      expect(seats).toHaveLength(total);
      expect(new Set(seats.map((seat) => seat.id)).size).toBe(total);
      expect(seats.map((seat) => seat.code)).toEqual(
        ["A", "B"].flatMap((deck) =>
          Array.from(
            { length: perDeck },
            (_value, index) => `${deck}${String(index + 1).padStart(2, "0")}`,
          ),
        ),
      );
    },
  );

  it("preserves Figma main/rear row geometry for each deck", () => {
    expect(
      seatLayouts["sleeper-34"].find((seat) => seat.code === "A12"),
    ).toMatchObject({ deck: "lower", row: 3, column: 2 });
    expect(
      seatLayouts["sleeper-34"].find((seat) => seat.code === "B17"),
    ).toMatchObject({ deck: "upper", row: 4, column: 4 });
    expect(
      seatLayouts["cabin-22"].find((seat) => seat.code === "A10"),
    ).toMatchObject({ deck: "lower", row: 4, column: 1 });
    expect(
      seatLayouts["cabin-22"].find((seat) => seat.code === "B11"),
    ).toMatchObject({ deck: "upper", row: 5, column: 0 });
  });

  it.each(["sleeper-34", "cabin-22"] as const)(
    "%s covers domain states and freezes every record",
    (vehicle) => {
      const seats = seatLayouts[vehicle];
      expect(new Set(seats.map((seat) => seat.status))).toEqual(
        new Set(["available", "held", "sold", "disabled"]),
      );
      expect(Object.isFrozen(seatLayouts)).toBe(true);
      expect(Object.isFrozen(seats)).toBe(true);
      for (const seat of seats) {
        expect(Object.isFrozen(seat)).toBe(true);
        expect(Reflect.set(seat, "status", "sold")).toBe(false);
      }
      expect(Reflect.set(seats, "0", {})).toBe(false);
    },
  );
});
