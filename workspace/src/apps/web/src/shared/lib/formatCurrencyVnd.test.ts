import { describe, expect, it } from "vitest";

import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";

describe("formatCurrencyVnd", () => {
  it.each<[number, string]>([
    [280_000, "280.000 ₫"],
    [0, "0 ₫"],
    [1_250_000, "1.250.000 ₫"],
  ])("formats integer VND %i with vi-VN grouping", (value, expected) => {
    expect(formatCurrencyVnd(value)).toBe(expected);
  });
  it("follows the planned Intl no-fraction display rule", () => {
    expect(formatCurrencyVnd(280_000.6)).toBe("280.001 ₫");
  });
});
