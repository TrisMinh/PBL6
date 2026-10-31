import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSessionClock } from "@/shared/lib/useSessionClock";

afterEach(() => vi.useRealTimers());

describe("useSessionClock", () => {
  it("does not authorize a replacement expiry using the previous session clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T00:00:00Z"));
    const observed: (number | null)[] = [];
    const { rerender } = renderHook(
      ({ expiresAt }) => {
        const now = useSessionClock(expiresAt);
        observed.push(now);
        return now;
      },
      { initialProps: { expiresAt: "2026-10-19T00:10:00Z" } },
    );

    observed.length = 0;
    vi.setSystemTime(new Date("2026-10-19T00:02:00Z"));
    rerender({ expiresAt: "2026-10-19T00:01:00Z" });

    expect(observed[0]).toBeNull();
    expect(observed.at(-1)).toBe(Date.parse("2026-10-19T00:02:00Z"));
  });
});
