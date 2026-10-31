import type { Seat, SeatStatus } from "@/features/booking/types/seat";
import type { VehicleType } from "@/features/trips/types/trip";

function seedStatus(vehicle: VehicleType, code: string): SeatStatus {
  const sold = vehicle === "sleeper-34" ? ["A09", "B11"] : ["B08"];
  if (sold.includes(code)) return "sold";
  if (code === "B07") return "held";
  if (code === (vehicle === "sleeper-34" ? "B17" : "A11")) return "disabled";
  return "available";
}

function createLayout(
  vehicle: VehicleType,
  count: number,
  columns: number,
  mainCount: number,
): readonly Readonly<Seat>[] {
  return Object.freeze(
    ["A", "B"].flatMap((prefix) =>
      Array.from({ length: count }, (_value, index) => {
        const code = `${prefix}${String(index + 1).padStart(2, "0")}`;
        return Object.freeze({
          id: `seat-${vehicle}-${code.toLowerCase()}`,
          code,
          deck: prefix === "A" ? "lower" : "upper",
          row:
            index < mainCount
              ? Math.floor(index / columns)
              : mainCount / columns,
          column: index < mainCount ? index % columns : index - mainCount,
          status: seedStatus(vehicle, code),
        } satisfies Seat);
      }),
    ),
  );
}

// Geometry follows Figma; selection belongs to sessions, never immutable seeds.
export const seatLayouts = Object.freeze({
  "sleeper-34": createLayout("sleeper-34", 17, 3, 12),
  "cabin-22": createLayout("cabin-22", 11, 2, 10),
});
