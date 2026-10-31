import { z } from "zod";

import { bookingPassengerCountSchema } from "@/features/booking/schemas/passengerCount.schema";
import { bookingAttemptKeySchema } from "@/features/booking/schemas/bookingCreation.schema";

const id = z.string().trim().min(1).max(128);
export const bookingSessionSchema = z
  .object({
    sessionId: id,
    bookingId: id.optional(),
    bookingAttemptKey: bookingAttemptKeySchema.optional(),
    tripId: id,
    passengerCount: bookingPassengerCountSchema,
    selectedSeatIds: z.array(id).max(6),
    contact: z
      .object({ fullName: z.string(), email: z.string(), phone: z.string() })
      .optional(),
    passengers: z
      .array(
        z.object({
          seatId: id,
          fullName: z.string(),
          phone: z.string().optional(),
        }),
      )
      .max(6),
    expiresAt: z.iso
      .datetime()
      .refine((value) => Date.parse(value) > Date.now()),
    totalVnd: z.number().int().nonnegative(),
    status: z.literal("active"),
  })
  .refine((session) => {
    const selected = new Set(session.selectedSeatIds);
    const passengerIds = session.passengers.map(
      (passenger) => passenger.seatId,
    );
    return (
      selected.size === session.selectedSeatIds.length &&
      new Set(passengerIds).size === passengerIds.length &&
      passengerIds.every((seatId) => selected.has(seatId)) &&
      (selected.size === 0 ? session.totalVnd === 0 : session.totalVnd > 0)
    );
  });
