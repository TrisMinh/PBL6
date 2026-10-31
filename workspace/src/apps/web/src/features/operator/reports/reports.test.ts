import { describe, it, expect } from "vitest";
import { reportSchema } from "./reports.schema";
async function request(query = ""): Promise<Response> {
  return fetch(
    new URL(`/api/v1/operator/reports-preview${query}`, window.location.origin),
  );
}
describe("Operator report preview", () => {
  it("returns the designed August KPIs, bookings and illustrative fleet", async () => {
    const report = reportSchema.parse(await (await request()).json());
    expect(report.totals).toEqual({
      revenue: 1820000000,
      costs: 586000000,
      tickets: 5684,
      customers: 4921,
    });
    expect(report.bookings).toHaveLength(5);
    expect(report.vehicles.filter((v) => v.status === "running")).toHaveLength(
      3,
    );
    expect(report.series[5]).toMatchObject({
      revenue: 82400000,
      tickets: 1032,
    });
    expect(report.referenceChart).toBe(true);
  });
  it("filters the requested week and custom dates instead of returning full-month totals", async () => {
    const week = reportSchema.parse(
      await (
        await request("?from=2026-08-01&to=2026-08-31&period=week1")
      ).json(),
    );
    expect(week.range).toEqual({ from: "2026-08-01", to: "2026-08-07" });
    expect(week.series).toHaveLength(7);
    expect(week.bookings).toHaveLength(0);
    expect(week.totals.revenue).toBeLessThan(1820000000);
    expect(week.referenceChart).toBe(false);
    const day = reportSchema.parse(
      await (
        await request("?from=2026-08-31&to=2026-08-31&period=month")
      ).json(),
    );
    expect(day.bookings).toHaveLength(2);
    expect(day.series).toHaveLength(1);
  });
  it("rejects invalid ranges and returns explicit empty data outside the demo month", async () => {
    for (const query of [
      "?from=2026-08-31&to=2026-08-01",
      "?from=2026-02-30&to=2026-08-31",
      "?period=invalid",
      "?from=2025-01-01&to=2026-08-31",
    ]) {
      expect((await request(query)).status).toBe(400);
    }
    const empty = reportSchema.parse(
      await (await request("?from=2026-09-01&to=2026-09-30")).json(),
    );
    expect(empty.totals.revenue).toBe(0);
    expect(empty.bookings).toHaveLength(0);
    expect(empty.series).toHaveLength(0);
  });
});
