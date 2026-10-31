import { afterEach, describe, expect, it } from "vitest";

import { formatDateTime } from "@/shared/lib/formatDateTime";

const originalTimezone = process.env.TZ;

afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe("formatDateTime", () => {
  it("formats UTC timestamps on the Vietnam calendar", () => {
    expect(formatDateTime("2098-12-31T23:30:00.000Z")).toBe("06:30");
    expect(formatDateTime("2098-12-31T23:30:00.000Z", "HH:mm dd/MM/yyyy")).toBe(
      "06:30 01/01/2099",
    );
  });

  it("uses the date-fns Vietnamese locale", () => {
    expect(formatDateTime("2026-10-19T00:00:00Z", "EEEE, dd MMMM yyyy")).toBe(
      "Thứ Hai, 19 tháng 10 2026",
    );
  });

  it.each(["UTC", "America/New_York", "Asia/Ho_Chi_Minh"])(
    "ignores host timezone %s including a DST gap",
    (timezone) => {
      process.env.TZ = timezone;
      expect(formatDateTime("2026-03-07T19:30:00Z", "HH:mm dd/MM/yyyy")).toBe(
        "02:30 08/03/2026",
      );
    },
  );

  it.each([
    "",
    "invalid",
    "2026-02-30T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-01-01T25:00:00Z",
    "2026-01-01T24:00:00Z",
    "2026-01-01",
    "2026-01-01T10:00:00",
    "2026-01-01T10:00:00+07:00",
  ])("returns an em dash for invalid or non-UTC ISO input %s", (value) => {
    expect(formatDateTime(value)).toBe("—");
  });
});
