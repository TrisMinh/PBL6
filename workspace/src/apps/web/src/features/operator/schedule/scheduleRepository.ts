import { rows, localDateTime, type Row } from "../liveOriginalApi";
import { scheduleTripSchema, type ScheduleTrip } from "./schedule.schema";
export async function scheduleResources(
  signal?: AbortSignal,
): Promise<{ trips: Row[]; buses: Row[]; drivers: Row[] }> {
  const [trips, buses, drivers] = await Promise.all([
    rows("/api/v1/operator/trips", signal),
    rows("/api/v1/operator/buses", signal),
    rows("/api/v1/operator/drivers", signal),
  ]);
  return { trips, buses, drivers };
}
export function adaptSchedule(
  t: Row,
  buses: Row[],
  drivers: Row[],
): ScheduleTrip {
  const bus = buses.find((b) => b.id === t.busId),
    driver = drivers.find((d) => d.id === t.driverId),
    departure = localDateTime(t.departureAt),
    arrival = localDateTime(t.arrivalAt),
    capacity =
      bus?.seats.filter((s: Row) => s.enabled).length ??
      t.availableSeatCount ??
      1;
  return scheduleTripSchema.parse({
    id: t.id,
    origin: t.origin,
    destination: t.destination,
    date: departure.slice(0, 10),
    departure: departure.slice(11),
    arrival: arrival.slice(11),
    vehicleLabel: bus?.plateNumber ?? t.busType,
    crew: driver?.fullName ?? driver?.licenseNumber ?? "Chưa phân công",
    passengers: Math.max(0, capacity - (t.availableSeatCount ?? capacity)),
    capacity: Math.max(1, capacity),
    status:
      t.status === "DRAFT"
        ? "draft"
        : t.status === "BOARDING"
          ? "boarding"
          : "scheduled",
    assignment: bus && driver ? "complete" : "missing",
  });
}
export async function getSchedule(
  signal?: AbortSignal,
): Promise<ScheduleTrip[]> {
  const { trips, buses, drivers } = await scheduleResources(signal);
  return trips
    .filter((t) => !["CANCELLED", "COMPLETED", "DEPARTED"].includes(t.status))
    .map((t) => adaptSchedule(t, buses, drivers));
}
