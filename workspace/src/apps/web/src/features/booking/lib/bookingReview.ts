import { getSelectedPassengerSeats } from "@/features/booking/lib/passengerDraft";
import { createPassengerSchema } from "@/features/booking/schemas/passenger.schema";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";

export function canReviewBooking(
  draft: BookingDraft,
  layout: SeatLayout,
): boolean {
  if (!getSelectedPassengerSeats(draft, layout)) return false;
  return createPassengerSchema(draft.selectedSeatIds).safeParse({
    contact: draft.contact,
    passengers: draft.passengers,
  }).success;
}
