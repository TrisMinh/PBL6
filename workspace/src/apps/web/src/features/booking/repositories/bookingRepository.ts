import type {
  BookingSession,
  ContactDraft,
  PassengerDraft,
} from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";

export interface BookingRequestOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
}
export interface BookingRepository {
  createBooking: (
    sessionId: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ) => Promise<BookingCreationSummary>;
  replacePassengers: (
    sessionId: string,
    contact: ContactDraft,
    passengers: readonly PassengerDraft[],
    signal?: AbortSignal,
  ) => Promise<BookingSession>;
  getSeats: (tripId: string, signal?: AbortSignal) => Promise<SeatLayout>;
  replaceSeats: (
    sessionId: string,
    seatIds: readonly string[],
    signal?: AbortSignal,
  ) => Promise<BookingSession>;
  createSession: (
    tripId: string,
    passengerCount: number,
    options?: BookingRequestOptions,
  ) => Promise<BookingSession>;
}
