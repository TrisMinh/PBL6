import {
  createPassengerSchema,
  type PassengerFormValues,
} from "@/features/booking/schemas/passenger.schema";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import type {
  BookingSession,
  ContactDraft,
  PassengerDraft,
} from "@/features/booking/types/booking";

export function parsePassengerValues(
  contact: ContactDraft,
  passengers: readonly PassengerDraft[],
): PassengerFormValues {
  let schema: ReturnType<typeof createPassengerSchema>;
  try {
    schema = createPassengerSchema(
      passengers.map((passenger) => passenger.seatId),
    );
  } catch {
    throw new BookingRepositoryError("VALIDATION_ERROR", 400);
  }
  const parsed = schema.safeParse({ contact, passengers });
  if (!parsed.success)
    throw new BookingRepositoryError("VALIDATION_ERROR", 400);
  return parsed.data;
}
export function passengerValuesMatch(
  session: BookingSession,
  values: PassengerFormValues,
): boolean {
  return (
    session.contact?.fullName === values.contact.fullName &&
    session.contact.email === values.contact.email &&
    session.contact.phone === values.contact.phone &&
    session.passengers.length === values.passengers.length &&
    values.passengers.every((passenger) =>
      session.passengers.some(
        (saved) =>
          saved.seatId === passenger.seatId &&
          saved.fullName === passenger.fullName &&
          saved.phone === passenger.phone,
      ),
    )
  );
}
