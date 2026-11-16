import { isMockApi } from "@/shared/api/config";
import { getLiveRows } from "@/shared/api/liveRequest";
import { stateLabel } from "@/shared/api/livePresentation";
export function vietnamParts(value: unknown): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(String(value)))
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
export async function getLiveSchedule(
  signal?: AbortSignal,
): Promise<ScheduleTrip[]> {
  const [trips, buses, bookings, drivers] = await Promise.all(
    ["trips", "buses", "bookings", "drivers"].map((r) =>
      getLiveRows(`/api/v1/operator/${r}`, signal),
    ),
  );
  return trips
    .filter((r) =>
      ["DRAFT", "SCHEDULED", "BOARDING"].includes(String(r.status)),
    )
    .map((row) => {
      const bus = buses.find((b) => b.id === row.busId),
        driver = drivers.find((d) => d.id === row.driverId);
      const passengers = bookings
        .filter(
          (b) =>
            b.tripId === row.id &&
            ["PAID", "CONFIRMED", "PENDING_PAYMENT", "COMPLETED"].includes(
              String(b.status),
            ),
        )
        .reduce((n, b) => n + (Array.isArray(b.items) ? b.items.length : 0), 0);
      return {
        id: String(row.id),
        origin: String(row.origin),
        destination: String(row.destination),
        date: vietnamParts(row.departureAt).date,
        departure: vietnamParts(row.departureAt).time,
        arrival: vietnamParts(row.arrivalAt).time,
        vehicleLabel: bus
          ? `${bus.plateNumber} · ${stateLabel(String(bus.type))}`
          : stateLabel(String(row.busType)),
        crew: driver
          ? String(driver.fullName || driver.licenseNumber)
          : "Chưa phân công",
        passengers,
        capacity:
          bus && Array.isArray(bus.seats)
            ? bus.seats.length
            : Number(row.availableSeatCount) || 1,
        status:
          row.status === "DRAFT"
            ? "draft"
            : row.status === "BOARDING"
              ? "boarding"
              : "scheduled",
        assignment: row.driverId && row.busId ? "complete" : "missing",
      };
    });
}
import { apiFetch as fetch } from "@/shared/api/client";
import { scheduleResponseSchema, type ScheduleTrip } from "./schedule.schema";

export async function getSchedule(
  signal?: AbortSignal,
): Promise<ScheduleTrip[]> {
  if (!isMockApi) return getLiveSchedule(signal);
  const response = await fetch("/api/v1/operator/schedule-preview", { signal });
  if (!response.ok) throw new Error("Không thể tải lịch chuyến.");
  return scheduleResponseSchema.parse(await response.json()).items;
}
