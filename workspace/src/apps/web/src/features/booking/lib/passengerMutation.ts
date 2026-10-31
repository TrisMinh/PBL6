import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import {
  createPassengerSchema,
  type PassengerFormValues,
} from "@/features/booking/schemas/passenger.schema";
import type {
  BookingDraft,
  BookingSession,
} from "@/features/booking/types/booking";

export interface PassengerMutationVariables {
  source: BookingDraft;
  values: PassengerFormValues;
  controller: AbortController;
  run: number;
}
function parseSubmission(
  source: BookingDraft,
  values: PassengerFormValues,
): PassengerFormValues {
  try {
    const parsed = createPassengerSchema(source.selectedSeatIds).safeParse(
      values,
    );
    if (parsed.success) return parsed.data;
  } catch {
    /* Invalid selected-seat boundary becomes the same safe validation error. */
  }
  throw new BookingRepositoryError("VALIDATION_ERROR", 400);
}
function matchesOriginalSession(
  session: BookingSession,
  source: BookingDraft,
): boolean {
  return (
    session.tripId === source.tripId &&
    session.bookingId === source.bookingId &&
    session.passengerCount === source.passengerCount &&
    session.expiresAt === source.expiresAt &&
    session.totalVnd === source.totalVnd &&
    session.selectedSeatIds.length === source.selectedSeatIds.length &&
    session.selectedSeatIds.every((id) => source.selectedSeatIds.includes(id))
  );
}
export async function executePassengerMutation(
  variables: PassengerMutationVariables,
): Promise<BookingSession> {
  const { source, values, controller } = variables;
  if (Date.parse(source.expiresAt) <= Date.now())
    throw new BookingRepositoryError("HOLD_EXPIRED", 410);
  const parsed = parseSubmission(source, values);
  const session = await httpBookingRepository.replacePassengers(
    source.sessionId,
    parsed.contact,
    parsed.passengers,
    controller.signal,
  );
  if (!matchesOriginalSession(session, source))
    throw new BookingRepositoryError("INVALID_RESPONSE", 200);
  return session;
}
