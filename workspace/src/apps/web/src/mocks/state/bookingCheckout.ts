import { createPassengerSchema } from "@/features/booking/schemas/passenger.schema";
import type { BookingSession } from "@/features/booking/types/booking";
import type { MockDb } from "@/mocks/state/mockDb";

export function isCompleteBookingSession(
  db: MockDb,
  session: BookingSession,
): boolean {
  const trip = db.trips.find((item) => item.id === session.tripId);
  const ids = session.selectedSeatIds;
  if (
    !trip ||
    ids.length !== session.passengerCount ||
    ids.length < 1 ||
    new Set(ids).size !== ids.length ||
    session.totalVnd !== trip.fareVnd * ids.length
  )
    return false;
  if (
    !ids.every(
      (id) =>
        db.holds.get(id) === session.sessionId &&
        db.seats
          .get(session.tripId)
          ?.some((seat) => seat.id === id && seat.status === "held"),
    )
  )
    return false;
  return createPassengerSchema(ids).safeParse({
    contact: session.contact,
    passengers: session.passengers,
  }).success;
}
