import { getLiveReport } from "./liveReports";
import { apiJson } from "@/shared/api/client";
import { isMockApi } from "@/shared/api/config";
import { operatorBookingRows } from "../bookings/bookingsRepository";
import { scheduleResources } from "../schedule/scheduleRepository";
import {
  reportSchema,
  type OperatorReport,
  type ReportPeriod,
} from "./reports.schema";
export async function getOperatorReport(
  from: string,
  to: string,
  period: ReportPeriod,
  signal?: AbortSignal,
): Promise<OperatorReport> {
  if (isMockApi) {
    const params = new URLSearchParams({ from, to, period });
    return apiJson(`/api/v1/operator/reports-preview?${params}`, reportSchema, {
      signal,
    });
  }
  const [report, bookings, resources] = await Promise.all([
    getLiveReport({ from, to }, signal),
    operatorBookingRows(signal),
    scheduleResources(signal),
  ]);
  const filtered = bookings.filter(
    (b) => b.createdDate && b.createdDate >= from && b.createdDate <= to,
  );
  const confirmed = filtered.filter((b) => b.status === "confirmed");
  const series = report.revenue.map((day) => ({
    date: day.perioddate,
    revenue: day.grossrevenue,
    tickets: confirmed
      .filter((b) => b.createdDate === day.perioddate)
      .reduce((sum, b) => sum + b.source.items.length, 0),
  }));
  return reportSchema.parse({
    range: { from, to },
    totals: {
      revenue: series.reduce((sum, r) => sum + r.revenue, 0),
      costs: null,
      tickets: confirmed.reduce((sum, b) => sum + b.source.items.length, 0),
      customers: new Set(filtered.map((b) => b.source.customerId)).size,
    },
    series,
    referenceChart: false,
    bookings: filtered.map((b) => ({
      id: b.id,
      name: b.name,
      route: `${b.origin} → ${b.destination}`,
      departure: b.departureDate,
      time: b.departureTime,
      vehicle:
        resources.buses.find((v) => v.id === b.trip?.busId)?.plateNumber ?? "—",
      seats: b.seat,
    })),
    vehicles: resources.buses.map((bus) => {
      const trip = resources.trips.find(
        (t) =>
          t.busId === bus.id &&
          ["DEPARTED", "IN_TRANSIT", "BOARDING"].includes(t.status),
      );
      return {
        id: bus.id,
        name: bus.type,
        plate: bus.plateNumber,
        trip: trip?.id ?? "",
        route: trip ? `${trip.origin} → ${trip.destination}` : "",
        status: trip ? "running" : "parked",
        x: null,
        y: null,
      };
    }),
  });
}
