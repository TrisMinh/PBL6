import { isMockApi } from "@/shared/api/config";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import type { HoldCountdown } from "@/features/booking/hooks/useHoldCountdown";

export function canContinueBooking(
  draft: BookingDraft,
  layout: SeatLayout,
  countdown: HoldCountdown,
  isPending = false,
): boolean {
  return (
    !isPending &&
    !countdown.isExpired &&
    countdown.remainingSeconds > 0 &&
    draft.selectedSeatIds.length === draft.passengerCount &&
    new Set(draft.selectedSeatIds).size === draft.passengerCount &&
    draft.totalVnd === layout.trip.fareVnd * draft.passengerCount &&
    draft.selectedSeatIds.every((id) =>
      layout.items.some(
        (seat) =>
          seat.id === id &&
          (seat.status === "available" ||
            (isMockApi && seat.status === "held")),
      ),
    )
  );
}
