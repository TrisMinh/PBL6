import { useEffect, useState } from "react";

import { getRemainingSeconds } from "@/features/booking/lib/getRemainingSeconds";

export interface HoldCountdown {
  remainingSeconds: number;
  isExpired: boolean;
}

function subscribeCountdown(
  expiresAt: string,
  onTick: (remainingSeconds: number) => void,
): () => void {
  let timer: number | undefined;
  const refresh = (): void => {
    window.clearTimeout(timer);
    const nowMs = Date.now();
    const remainingSeconds = getRemainingSeconds(expiresAt, nowMs);
    onTick(remainingSeconds);
    if (remainingSeconds > 0)
      timer = window.setTimeout(
        refresh,
        Math.min(1_000, Date.parse(expiresAt) - nowMs),
      );
  };
  refresh();
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", refresh);
  };
}

export function useHoldCountdown(expiresAt: string): HoldCountdown {
  const [snapshot, setSnapshot] = useState<{
    expiresAt: string;
    remainingSeconds: number;
  } | null>(null);
  useEffect(
    () =>
      subscribeCountdown(expiresAt, (remainingSeconds) =>
        setSnapshot({ expiresAt, remainingSeconds }),
      ),
    [expiresAt],
  );
  // Zero before this expiry's effect is evaluated is neutral, not expired.
  if (!snapshot || snapshot.expiresAt !== expiresAt)
    return { remainingSeconds: 0, isExpired: false };
  return {
    remainingSeconds: snapshot.remainingSeconds,
    isExpired: snapshot.remainingSeconds === 0,
  };
}
