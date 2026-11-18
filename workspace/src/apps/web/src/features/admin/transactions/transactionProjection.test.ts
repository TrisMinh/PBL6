import { describe, expect, it } from "vitest";
import { transactionDate } from "./transactionProjection";

describe("transaction dates", () => {
  it.each(["", "not-a-date", "2026-99-99T00:00:00Z", null, undefined])(
    "keeps missing or invalid API dates from crashing rendering: %s",
    (value) => {
      expect(transactionDate(value)).toBe("—");
      expect(transactionDate(value, true)).toBe("—");
    },
  );
  it("formats valid API timestamps in Vietnam time", () => {
    expect(transactionDate("2026-11-17T23:30:00Z", true)).toBe(
      "18/11/2026 · 06:30",
    );
  });
});
