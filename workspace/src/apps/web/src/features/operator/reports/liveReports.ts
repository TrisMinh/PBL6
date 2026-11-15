import { z } from "zod";
import { apiJson } from "@/shared/api/client";

export interface ReportRange {
  from: string;
  to: string;
}
const envelope = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  dataAsOf: z.string(),
});
const revenueRow = z.object({
  perioddate: z.string(),
  grossrevenue: z.coerce.number(),
  refundamount: z.coerce.number(),
  netrevenue: z.coerce.number(),
});
const bookingRow = z.object({
  bookingid: z.string(),
  bookingcode: z.string(),
  status: z.string(),
  bookedat: z.string(),
});
export interface LiveReport {
  revenue: z.infer<typeof revenueRow>[];
  bookings: z.infer<typeof bookingRow>[];
  dataAsOf: string;
}
const lowerKeys = (row: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]),
  );
export const shiftDate = (day: string, offset: number): string =>
  new Date(Date.parse(day + "T00:00:00Z") + offset * 86400000)
    .toISOString()
    .slice(0, 10);
export function previousRange(range: ReportRange): ReportRange {
  const days =
    Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) + 1;
  return { from: shiftDate(range.from, -days), to: shiftDate(range.from, -1) };
}
export async function getLiveReport(
  range: ReportRange,
  signal?: AbortSignal,
): Promise<LiveReport> {
  const params = new URLSearchParams({
    from: `${range.from}T00:00:00+07:00`,
    to: `${range.to}T23:59:59.9999999+07:00`,
    timezone: "Asia/Ho_Chi_Minh",
  });
  const [revenue, bookings] = await Promise.all([
    apiJson(`/api/v1/reports/revenue?${params}`, envelope, { signal }),
    apiJson(`/api/v1/reports/bookings?${params}`, envelope, { signal }),
  ]);
  const days = revenue.data
    .map((row) => revenueRow.parse(lowerKeys(row)))
    .map((row) => ({ ...row, perioddate: row.perioddate.slice(0, 10) }))
    .filter(
      (row) => row.perioddate >= range.from && row.perioddate <= range.to,
    );
  return {
    revenue: days,
    bookings: bookings.data.map((row) => bookingRow.parse(lowerKeys(row))),
    dataAsOf: revenue.dataAsOf,
  };
}
export function money(value: number): string {
  const absolute = Math.abs(value);
  return absolute >= 1e9
    ? `${(value / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`
    : absolute >= 1e6
      ? `${(value / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu`
      : `${value.toLocaleString("vi-VN", { maximumFractionDigits: 0 })} đ`;
}
