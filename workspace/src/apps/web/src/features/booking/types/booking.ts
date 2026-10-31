import type { PaymentAttempt } from "@/features/payment/types/payment";

export interface ContactDraft {
  fullName: string;
  email: string;
  phone: string;
}

export interface PassengerDraft {
  seatId: string;
  fullName: string;
  phone?: string;
}

export interface BookingDraft {
  sessionId: string;
  bookingId?: string;
  bookingAttemptKey?: string;
  paymentAttempt?: PaymentAttempt;
  tripId: string;
  passengerCount: number;
  selectedSeatIds: string[];
  contact?: ContactDraft;
  passengers: PassengerDraft[];
  expiresAt: string;
  totalVnd: number;
}

export interface BookingSession extends BookingDraft {
  status: "active" | "expired" | "completed";
}
