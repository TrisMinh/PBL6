import { afterEach, describe, expect, it, vi } from "vitest";

import { getRemainingSeconds } from "@/features/booking/lib/getRemainingSeconds";

const NOW = Date.parse("2026-10-20T00:00:00Z");
const EXPIRY = "2026-10-20T00:10:00Z";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("getRemainingSeconds — FR-011", () => {
  it("uses original expiry and an injectable clock for 600/599/300 seconds", () => {
    expect(getRemainingSeconds(EXPIRY, NOW)).toBe(600);
    expect(getRemainingSeconds(EXPIRY, NOW + 1_000)).toBe(599);
    expect(getRemainingSeconds(EXPIRY, NOW + 300_000)).toBe(300);
  });
  it.each([
    [1, 1],
    [999, 1],
    [1_001, 2],
    [1_999, 2],
    [0, 0],
    [-1, 0],
    [-60_000, 0],
  ])("ceil remaining delta %i ms to %i seconds", (delta, expected) => {
    expect(getRemainingSeconds(new Date(NOW + delta).toISOString(), NOW)).toBe(
      expected,
    );
  });
  it.each(["", "invalid", "999999-01-01T00:00:00Z"])(
    "invalid date %s fails closed",
    (expiry) => {
      expect(getRemainingSeconds(expiry, NOW)).toBe(0);
    },
  );
  it.each([NaN, Infinity, -Infinity])(
    "non-finite clock %s fails closed",
    (clock) => {
      expect(getRemainingSeconds(EXPIRY, clock)).toBe(0);
    },
  );
  it("defaults to real Date.now without requiring browser globals", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW + 300_000);
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    expect(getRemainingSeconds(EXPIRY)).toBe(300);
  });
});
