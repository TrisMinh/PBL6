import { z } from "zod";

import type { Seat, SeatLayout } from "@/features/booking/types/seat";
import { tripSchema } from "@/features/trips/schemas/tripResponse.schema";

const seatSchema = z.object({
  id: z.string().min(1).max(128),
  code: z.string().regex(/^[AB]\d{2}$/),
  deck: z.enum(["lower", "upper"]),
  row: z.number().int().min(0).max(5),
  column: z.number().int().min(0).max(4),
  status: z.enum(["available", "held", "sold", "disabled"]),
});
export const seatLayoutSchema = z
  .object({
    tripId: z.string().min(1),
    vehicleType: z.enum(["sleeper-34", "cabin-22"]),
    trip: tripSchema,
    items: z.array(seatSchema),
  })
  .refine((layout) => {
    const ids = layout.items.map((seat) => seat.id);
    const cells = layout.items.map(
      (seat) => `${seat.deck}:${seat.row}:${seat.column}`,
    );
    return (
      layout.tripId === layout.trip.id &&
      layout.vehicleType === layout.trip.vehicleType &&
      layout.items.length === (layout.vehicleType === "sleeper-34" ? 34 : 22) &&
      new Set(ids).size === ids.length &&
      new Set(cells).size === cells.length &&
      layout.items.every(
        (seat) =>
          seat.id === `${layout.tripId}:${seat.code}` &&
          seat.code.startsWith(seat.deck === "lower" ? "A" : "B") &&
          canonicalGeometry(seat, layout.vehicleType),
      )
    );
  });

function canonicalGeometry(
  seat: Seat,
  vehicle: SeatLayout["vehicleType"],
): boolean {
  const index = Number(seat.code.slice(1)) - 1;
  const columns = vehicle === "sleeper-34" ? 3 : 2;
  const main = vehicle === "sleeper-34" ? 12 : 10;
  const total = vehicle === "sleeper-34" ? 17 : 11;
  return (
    index >= 0 &&
    index < total &&
    seat.row ===
      (index < main ? Math.floor(index / columns) : main / columns) &&
    seat.column === (index < main ? index % columns : index - main)
  );
}
