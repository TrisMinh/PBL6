import type { SeatLayout } from "../types/seat";

/** Display template only; IDs and availability always come from the backend. */
export function presentationSeatLayout(layout: SeatLayout): SeatLayout | null {
  const cabin = layout.vehicleType === "cabin-22";
  const count = cabin ? 11 : 17;
  const columns = cabin ? 2 : 3;
  const mainCount = cabin ? 10 : 12;
  const expected = new Set(
    ["A", "B"].flatMap((prefix) =>
      Array.from(
        { length: count },
        (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`,
      ),
    ),
  );
  if (
    layout.items.length !== count * 2 ||
    new Set(layout.items.map((seat) => seat.id)).size !== layout.items.length
  )
    return null;
  for (const seat of layout.items) {
    if (!expected.delete(seat.code)) return null;
  }
  return {
    ...layout,
    items: layout.items.map((seat) => {
      const index = Number(seat.code.slice(1)) - 1;
      return {
        ...seat,
        deck: seat.code.startsWith("A") ? "lower" : "upper",
        row:
          index < mainCount ? Math.floor(index / columns) : mainCount / columns,
        column: index < mainCount ? index % columns : index - mainCount,
      };
    }),
  };
}
