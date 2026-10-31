import { useEffect } from "react";
import { useNavigate } from "react-router";

import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { bookingResultsPath } from "@/features/booking/lib/bookingRecovery";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import { ROUTES } from "@/shared/config/routes";

export function releaseExpiredSeats(tripId: string): void {
  // GET is the authoritative mock boundary that releases expired ownership.
  void httpBookingRepository.getSeats(tripId).catch(() => {
    // Offline cleanup is retried by the next authoritative GET/hydration.
  });
}
export function useBookingExpiry(
  draft: BookingDraft,
  layout: SeatLayout | undefined,
  isExpired: boolean,
): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isExpired) return;
    const current = useBookingDraftStore.getState().draft;
    if (current?.sessionId !== draft.sessionId) return;
    // ExpiredBookingState clears the draft after recovery commits. Clearing
    // here lets the still-mounted guard replace the trusted recovery URL.
    void navigate(
      layout
        ? bookingResultsPath(layout, draft.passengerCount, true)
        : `${ROUTES.trips}?reason=expired`,
      { replace: true },
    );
  }, [
    draft.sessionId,
    draft.tripId,
    draft.passengerCount,
    layout,
    isExpired,
    navigate,
  ]);
}
