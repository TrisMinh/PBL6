import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { shiftDate } from "./liveReports";

export const revenueTimezone = "Asia/Ho_Chi_Minh";

export const revenueRangeSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine(({ from, to }) => from <= to && shiftDate(from, 365) >= to);

export type RevenueRange = z.infer<typeof revenueRangeSchema>;

const amounts = {
  grossRevenue: z.int().nonnegative(),
  refundAmount: z.int().nonnegative(),
  netRevenue: z.int(),
  platformCommission: z.int(),
  operatorPayable: z.int(),
  unsettledAmount: z.int(),
  paymentCount: z.int().nonnegative(),
  refundCount: z.int().nonnegative(),
};

const revenueAmounts = z.object(amounts);
export type RevenueAmounts = z.infer<typeof revenueAmounts>;

const dailyRevenue = revenueAmounts.extend({
  periodDate: z.iso.date(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  dataAsOf: z.iso.datetime({ offset: true }),
});
export type RevenueDay = z.infer<typeof dailyRevenue>;

const reportSchema = z.object({
  data: z.array(dailyRevenue),
  dataAsOf: z.iso.datetime({ offset: true }).nullable(),
});

export function fetchRevenue(
  range: RevenueRange,
  signal?: AbortSignal,
  allTime = false,
): Promise<z.infer<typeof reportSchema>> {
  const params = new URLSearchParams({
    from: `${range.from}T00:00:00+07:00`,
    to: `${range.to}T23:59:59.999999+07:00`,
    timezone: revenueTimezone,
    operatorOnly: "true",
  });
  if (allTime) params.set("allTime", "true");
  return apiJson(`/api/v1/reports/revenue?${params}`, reportSchema, { signal });
}

const emptyAmounts: RevenueAmounts = {
  grossRevenue: 0,
  refundAmount: 0,
  netRevenue: 0,
  platformCommission: 0,
  operatorPayable: 0,
  unsettledAmount: 0,
  paymentCount: 0,
  refundCount: 0,
};

export function sumRevenue(rows: RevenueAmounts[]): RevenueAmounts {
  return rows.reduce(
    (total, row) => ({
      grossRevenue: total.grossRevenue + row.grossRevenue,
      refundAmount: total.refundAmount + row.refundAmount,
      netRevenue: total.netRevenue + row.netRevenue,
      platformCommission: total.platformCommission + row.platformCommission,
      operatorPayable: total.operatorPayable + row.operatorPayable,
      unsettledAmount: total.unsettledAmount + row.unsettledAmount,
      paymentCount: total.paymentCount + row.paymentCount,
      refundCount: total.refundCount + row.refundCount,
    }),
    emptyAmounts,
  );
}

export function reportBucketUnit(
  range: RevenueRange,
): "day" | "month" | "year" {
  const days = (Date.parse(range.to) - Date.parse(range.from)) / 86400000 + 1;
  return days > 730 ? "year" : days > 92 ? "month" : "day";
}

export function reportBuckets(
  range: RevenueRange,
  maxDailyBuckets = 20,
  unit = reportBucketUnit(range),
): RevenueRange[] {
  const buckets: RevenueRange[] = [];
  const days =
    Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) + 1;
  const size = Math.ceil(days / maxDailyBuckets);
  for (let from = range.from; from <= range.to;) {
    const year = Number(from.slice(0, 4));
    const month = Number(from.slice(5, 7));
    const end =
      unit === "year"
        ? `${from.slice(0, 4)}-12-31`
        : unit === "month"
          ? new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
          : shiftDate(
              from,
              Math.min(
                size - 1,
                Math.round(
                  (Date.parse(range.to) - Date.parse(from)) / 86400000,
                ),
              ),
            );
    const to = end < range.to ? end : range.to;
    buckets.push({ from, to });
    from = shiftDate(to, 1);
  }
  return buckets;
}

export function priorCalendarYear(range: RevenueRange): RevenueRange {
  function previous(date: string): string {
    const year = Number(date.slice(0, 4)) - 1;
    const month = Number(date.slice(5, 7));
    const day = Math.min(
      Number(date.slice(8, 10)),
      new Date(Date.UTC(year, month, 0)).getUTCDate(),
    );
    return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  }
  return { from: previous(range.from), to: previous(range.to) };
}

export function revenueSeries(
  rows: RevenueDay[],
  range: RevenueRange,
  unit = reportBucketUnit(range),
): (RevenueRange & RevenueAmounts)[] {
  return reportBuckets(range, 20, unit).map(({ from, to }) => ({
    from,
    to,
    ...sumRevenue(
      rows.filter((row) => row.periodDate >= from && row.periodDate <= to),
    ),
  }));
}

export const revenueColumns = [
  ["grossRevenue", "Tiền thu"],
  ["refundAmount", "Tiền hoàn"],
  ["netRevenue", "Thu ròng"],
  ["platformCommission", "Hoa hồng"],
  ["operatorPayable", "Phải trả nhà xe"],
  ["unsettledAmount", "Chênh lệch đối soát"],
] as const;

export function revenueCsv(rows: RevenueDay[]): string {
  const header = [
    "Ngày (UTC+7)",
    "Tiền tệ",
    ...revenueColumns.map(([, label]) => label),
    "Lượt thu",
    "Lượt hoàn",
  ];
  const lines = rows.map((row) =>
    [
      row.periodDate,
      row.currency,
      ...revenueColumns.map(([key]) => row[key]),
      row.paymentCount,
      row.refundCount,
    ].join(","),
  );
  return "\uFEFF" + [header.join(","), ...lines].join("\r\n");
}
