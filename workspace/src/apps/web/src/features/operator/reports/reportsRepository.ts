import { getLiveRevenue } from "./liveReports";
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
  const schedule = scheduleResources(signal);
  const [report, filtered, resources] = await Promise.all([
    getLiveRevenue({ from, to }, signal),
    operatorBookingRows(
      { from, to },
      schedule.then(({ trips }) => trips),
      signal,
    ),
    schedule,
  ]);
  const ticketsByDay = new Map<string, number>();
  let tickets = 0;
  for (const booking of filtered) {
    if (booking.status !== "confirmed") continue;
    const count = booking.source.items.length;
    ticketsByDay.set(
      booking.createdDate,
      (ticketsByDay.get(booking.createdDate) ?? 0) + count,
    );
    tickets += count;
  }
  const buses = new Map(resources.buses.map((bus) => [bus.id, bus]));
  const runningByBus = new Map<string, (typeof resources.trips)[number]>();
  for (const trip of resources.trips) {
    if (
      ["DEPARTED", "IN_TRANSIT", "BOARDING"].includes(trip.status) &&
      !runningByBus.has(trip.busId)
    )
      runningByBus.set(trip.busId, trip);
  }
  const series = report.revenue.map((day) => ({
    date: day.perioddate,
    revenue: day.grossrevenue,
    tickets: ticketsByDay.get(day.perioddate) ?? 0,
  }));
  return reportSchema.parse({
    range: { from, to },
    totals: {
      revenue: series.reduce((sum, r) => sum + r.revenue, 0),
      costs: null,
      tickets,
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
      vehicle: buses.get(b.trip?.busId)?.plateNumber ?? "—",
      seats: b.seat,
    })),
    vehicles: resources.buses.map((bus) => {
      const trip = runningByBus.get(bus.id);
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
