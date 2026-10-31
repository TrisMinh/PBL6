import { afterEach, describe, expect, it, vi } from "vitest";

import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";

afterEach(() => vi.useRealTimers());

describe("Vietnam product calendar", () => {
  it.each([
    ["2026-10-19T16:59:59Z", "2026-10-19"],
    ["2026-10-19T17:00:00Z", "2026-10-20"],
    ["2028-02-28T17:00:00Z", "2028-02-29"],
  ])(
    "formats %s by Asia/Ho_Chi_Minh, not host timezone",
    (instant, expected) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(instant));
      expect(getVietnamTodayDate()).toBe(expected);
    },
  );
});
