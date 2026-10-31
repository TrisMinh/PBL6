import { isMockApi } from "@/shared/api/config";
import { backendBookingRepository } from "./backendBookingRepository";
import {
  parsePassengerValues,
  passengerValuesMatch,
} from "@/features/booking/lib/passengerValues";
import type { BookingRepository } from "@/features/booking/repositories/bookingRepository";
import { requestBooking } from "@/features/booking/repositories/bookingHttp";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { bookingSessionSchema } from "@/features/booking/schemas/bookingSession.schema";
import { seatLayoutSchema } from "@/features/booking/schemas/seatLayout.schema";
import {
  bookingAttemptKeySchema,
  bookingCreationSchema,
} from "@/features/booking/schemas/bookingCreation.schema";

const mockRepository: BookingRepository = {
  createBooking: async (sessionId, idempotencyKey, signal) => {
    if (
      !bookingAttemptKeySchema.safeParse(idempotencyKey).success ||
      !sessionId.trim()
    )
      throw new BookingRepositoryError("VALIDATION_ERROR", 400);
    const booking = await requestBooking(
      "/api/v1/bookings",
      bookingCreationSchema,
      {
        method: "POST",
        body: { sessionId },
        idempotencyKey,
        signal,
        expectedStatus: 201,
      },
    );
    if (booking.sessionId !== sessionId)
      throw new BookingRepositoryError("INVALID_RESPONSE", 201);
    return booking;
  },
  replacePassengers: async (sessionId, contact, passengers, signal) => {
    const values = parsePassengerValues(contact, passengers);
    const session = await requestBooking(
      `/api/v1/booking-sessions/${encodeURIComponent(sessionId)}/passengers`,
      bookingSessionSchema,
      { method: "PUT", body: values, signal, expectedStatus: 200 },
    );
    if (
      session.sessionId !== sessionId ||
      !passengerValuesMatch(session, values)
    )
      throw new BookingRepositoryError("INVALID_RESPONSE", 200);
    return session;
  },
  createSession: async (tripId, passengerCount, options = {}) => {
    const session = await requestBooking(
      "/api/v1/booking-sessions",
      bookingSessionSchema,
      {
        method: "POST",
        body: { tripId, passengerCount },
        ...options,
        idempotencyKey: options.idempotencyKey ?? crypto.randomUUID(),
        expectedStatus: 201,
      },
    );
    if (session.tripId !== tripId || session.passengerCount !== passengerCount)
      throw new BookingRepositoryError("INVALID_RESPONSE", 201);
    return session;
  },
  getSeats: async (tripId, signal) => {
    const layout = await requestBooking(
      `/api/v1/trips/${encodeURIComponent(tripId)}/seats`,
      seatLayoutSchema,
      { signal, expectedStatus: 200 },
    );
    if (layout.tripId !== tripId)
      throw new BookingRepositoryError("INVALID_RESPONSE", 200);
    return layout;
  },
  replaceSeats: async (sessionId, seatIds, signal) => {
    const session = await requestBooking(
      `/api/v1/booking-sessions/${encodeURIComponent(sessionId)}/seats`,
      bookingSessionSchema,
      {
        method: "PUT",
        body: { seatIds: [...seatIds] },
        signal,
        seatIds,
        expectedStatus: 200,
      },
    );
    if (
      session.sessionId !== sessionId ||
      session.selectedSeatIds.length !== seatIds.length ||
      session.selectedSeatIds.some((id) => !seatIds.includes(id))
    )
      throw new BookingRepositoryError("INVALID_RESPONSE", 200);
    return session;
  },
};

export const httpBookingRepository = isMockApi
  ? mockRepository
  : backendBookingRepository;
