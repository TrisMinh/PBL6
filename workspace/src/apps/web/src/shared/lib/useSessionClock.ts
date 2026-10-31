import { useEffect, useState } from "react";

const MAX_TIMEOUT_MS = 2_147_483_647;

export function useSessionClock(expiresAt?: string): number | null {
  const [snapshot, setSnapshot] = useState<{
    expiresAt: string | undefined;
    nowMs: number;
  } | null>(null);

  useEffect(() => {
    let timeoutId: number | undefined;
    const refresh = (): void => {
      window.clearTimeout(timeoutId);
      const now = Date.now();
      setSnapshot({ expiresAt, nowMs: now });
      const remaining = expiresAt ? Date.parse(expiresAt) - now : 0;
      if (remaining > 0) {
        timeoutId = window.setTimeout(
          refresh,
          Math.min(remaining, MAX_TIMEOUT_MS),
        );
      }
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [expiresAt]);

  // A replacement session must be checked before its protected outlet can render.
  return snapshot?.expiresAt === expiresAt ? (snapshot?.nowMs ?? null) : null;
}
