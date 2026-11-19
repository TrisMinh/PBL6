import { describe, expect, it } from "vitest";
import { previousRange } from "./liveReports";
import {
  revenueCsv,
  reportBuckets,
  priorCalendarYear,
  revenueRangeSchema,
  revenueSeries,
  sumRevenue,
  type RevenueDay,
} from "./revenueReport";

const collected: RevenueDay = {
  periodDate: "2026-11-17",
  currency: "VND",
  dataAsOf: "2026-11-18T10:00:00Z",
  grossRevenue: 150001,
  refundAmount: 0,
  netRevenue: 150001,
  platformCommission: 18000,
  operatorPayable: 132001,
  unsettledAmount: 0,
  paymentCount: 1,
  refundCount: 0,
};
const refunded: RevenueDay = {
  ...collected,
  periodDate: "2026-11-19",
  grossRevenue: 0,
  refundAmount: 50001,
  netRevenue: -50001,
  platformCommission: -6000,
  operatorPayable: -44001,
  paymentCount: 0,
  refundCount: 1,
};

describe("Operator revenue report", () => {
  it("plots empty days and preserves refunds in a different day", () => {
    const range = { from: "2026-11-17", to: "2026-11-19" };
    expect(
      revenueSeries([collected, refunded], range).map(
        ({ grossRevenue, refundAmount }) => [grossRevenue, refundAmount],
      ),
    ).toEqual([
      [150001, 0],
      [0, 0],
      [0, 50001],
    ]);
    expect(sumRevenue([collected, refunded])).toMatchObject({
      netRevenue: 100000,
      platformCommission: 12000,
      operatorPayable: 88000,
      unsettledAmount: 0,
      paymentCount: 1,
      refundCount: 1,
    });
  });

  it("groups a long range without dropping the final date", () => {
    const range = { from: "2026-09-01", to: "2026-11-19" };
    const series = revenueSeries([collected, refunded], range);
    expect(series.length).toBeLessThanOrEqual(20);
    expect(series.at(-1)?.to).toBe(range.to);
    expect(sumRevenue(series).netRevenue).toBe(100000);
  });

  it("accepts single days and leap days while rejecting oversized or invalid dates", () => {
    expect(
      revenueRangeSchema.safeParse({ from: "2028-02-29", to: "2028-02-29" })
        .success,
    ).toBe(true);
    expect(
      revenueRangeSchema.safeParse({ from: "2027-02-29", to: "2027-03-01" })
        .success,
    ).toBe(false);
    expect(
      revenueRangeSchema.safeParse({ from: "2028-01-01", to: "2029-01-01" })
        .success,
    ).toBe(false);
    expect(previousRange({ from: "2028-03-01", to: "2028-03-01" })).toEqual({
      from: "2028-02-29",
      to: "2028-02-29",
    });
  });

  it("groups year-to-date by calendar month and matches the previous leap-date cutoff", () => {
    const annual = { from: "2028-01-01", to: "2028-02-29" };
    expect(reportBuckets(annual, 20, "month")).toEqual([
      { from: "2028-01-01", to: "2028-01-31" },
      { from: "2028-02-01", to: "2028-02-29" },
    ]);
    expect(priorCalendarYear(annual)).toEqual({
      from: "2027-01-01",
      to: "2027-02-28",
    });
  });

  it("aggregates all-time years without dropping activity in the first or last year", () => {
    const first = { ...collected, periodDate: "2021-10-01" };
    const buckets = revenueSeries([first, refunded], {
      from: first.periodDate,
      to: refunded.periodDate,
    });
    expect(buckets).toHaveLength(6);
    expect(buckets[0].grossRevenue).toBe(150001);
    expect(buckets.at(-1)?.refundAmount).toBe(50001);
  });

  it("exports unrounded amounts and negative adjustments with Vietnamese UTF-8 headers", () => {
    expect(revenueCsv([refunded]).split("\r\n")).toEqual([
      "\uFEFFNgày (UTC+7),Tiền tệ,Tiền thu,Tiền hoàn,Thu ròng,Hoa hồng,Phải trả nhà xe,Chênh lệch đối soát,Lượt thu,Lượt hoàn",
      "2026-11-19,VND,0,50001,-50001,-6000,-44001,0,0,1",
    ]);
  });
});
