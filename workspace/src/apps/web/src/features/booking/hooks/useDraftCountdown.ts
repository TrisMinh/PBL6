import { isMockApi } from "@/shared/api/config";
import { useHoldCountdown, type HoldCountdown } from "./useHoldCountdown";
export type { HoldCountdown } from "./useHoldCountdown";

// Live drafts own no seats and have no hold deadline. Actual holds/payments
// continue to use useHoldCountdown with the backend's expiresAt.
export function useDraftCountdown(expiresAt: string): HoldCountdown {
  const countdown = useHoldCountdown(isMockApi ? expiresAt : "");
  return isMockApi ? countdown : { remainingSeconds: 1, isExpired: false };
}
