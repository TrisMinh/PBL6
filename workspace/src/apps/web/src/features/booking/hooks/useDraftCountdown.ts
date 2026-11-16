import { isMockApi } from "@/shared/api/config";
import { useHoldCountdown, type HoldCountdown } from "./useHoldCountdown";
import { useBookingDraftStore } from "../store/bookingDraftStore";
export type { HoldCountdown } from "./useHoldCountdown";

export function useDraftCountdown(expiresAt: string): HoldCountdown {
  const selected = useBookingDraftStore(
    (state) => state.draft?.selectedSeatIds.length ?? 0,
  );
  const countdown = useHoldCountdown(expiresAt);
  return isMockApi || selected > 0
    ? countdown
    : { remainingSeconds: 0, isExpired: false };
}
