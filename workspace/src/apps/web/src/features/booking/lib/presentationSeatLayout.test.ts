import { describe, expect, it } from "vitest";
import { createMockDb } from "@/mocks/state/mockDb";
import { presentationSeatLayout } from "./presentationSeatLayout";
import type { SeatLayout } from "../types/seat";

function layout(vehicleType: SeatLayout["vehicleType"]): SeatLayout {
  const db = createMockDb();
  const trip = db.trips.find((trip) => trip.vehicleType === vehicleType);
  if (!trip) throw new Error("Missing fixture trip");
  const items = db.seats.get(trip.id);
  if (!items) throw new Error("Missing fixture seats");
  return { tripId: trip.id, trip, vehicleType, items };
}
describe("presentation seat templates", () => {
  it.each(["sleeper-34", "cabin-22"] as const)(
    "keeps every backend ID and status for %s",
    (type) => {
      const original = layout(type);
      const input = {
        ...original,
        items: [...original.items]
          .reverse()
          .map((seat) => ({ ...seat, row: 99, column: 99 })),
      };
      const output = presentationSeatLayout(input);
      if (!output) throw new Error("Expected compatible layout");
      expect(
        output.items.map(({ id, code, status }) => ({ id, code, status })),
      ).toEqual(
        input.items.map(({ id, code, status }) => ({ id, code, status })),
      );
      for (const seat of output.items) {
        const expected = original.items.find(
          (item) => item.code === seat.code,
        );
        if (!expected) throw new Error("Unknown seat code");
        expect(seat).toMatchObject({
          row: expected.row,
          column: expected.column,
          deck: expected.deck,
        });
      }
    },
  );
  it("uses the basic view for missing or duplicate codes, or duplicate IDs", () => {
    const original = layout("sleeper-34");
    expect(
      presentationSeatLayout({ ...original, items: original.items.slice(1) }),
    ).toBeNull();
    expect(
      presentationSeatLayout({
        ...original,
        items: original.items.map((seat, i) =>
          i === 0 ? { ...seat, code: original.items[1].code } : seat,
        ),
      }),
    ).toBeNull();
    expect(
      presentationSeatLayout({
        ...original,
        items: original.items.map((seat, i) =>
          i === 0 ? { ...seat, id: original.items[1].id } : seat,
        ),
      }),
    ).toBeNull();
  });
});
