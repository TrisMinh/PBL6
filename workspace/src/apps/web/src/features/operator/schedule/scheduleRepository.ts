import { rows, request, localDateTime, type Row } from "../liveOriginalApi";
import {
  scheduleTripSchema,
  type ScheduleTrip,
  type ScheduleCriteria,
} from "./schedule.schema";
import { tripPictures } from "../create/tripPresentation";
import { getDriverResourceRows } from "../drivers/driversRepository";
export async function scheduleResources(
  signal?: AbortSignal,
  tripId?: string,
): Promise<{ trips: Row[]; buses: Row[]; drivers: Row[] }> {
  const [trips, buses, drivers] = await Promise.all([
    rows(
      tripId
        ? `/api/v1/operator/trips?tripId=${encodeURIComponent(tripId)}`
        : "/api/v1/operator/trips",
      signal,
    ),
    rows("/api/v1/operator/buses", signal),
    getDriverResourceRows(signal),
  ]);
  return { trips, buses, drivers };
}
export function adaptSchedule(
  t: Row,
  buses: Row[] | Map<string, Row>,
  drivers: Row[] | Map<string, Row>,
): ScheduleTrip {
  const bus = Array.isArray(buses)
      ? buses.find((b) => b.id === t.busId)
      : buses.get(t.busId),
    driver = Array.isArray(drivers)
      ? drivers.find((d) => d.id === t.driverId)
      : drivers.get(t.driverId),
    departure = localDateTime(t.departureAt),
    arrival = localDateTime(t.arrivalAt),
    capacity =
      bus?.seats.filter((s: Row) => s.enabled).length ??
      t.availableSeatCount ??
      1;
  return scheduleTripSchema.parse({
    id: t.id,
    rowVersion: t.rowVersion,
    origin: t.origin,
    destination: t.destination,
    date: departure.slice(0, 10),
    departure: departure.slice(11),
    arrival: arrival.slice(11),
    arrivalDate: arrival.slice(0, 10),
    ...(Array.isArray(t.stops)
      ? {
          pickupStops: t.stops
            .filter((stop: Row) => stop.pickupAllowed)
            .map((stop: Row) => stop.name),
          dropoffStops: t.stops
            .filter((stop: Row) => stop.dropoffAllowed)
            .map((stop: Row) => stop.name),
        }
      : {}),
    ...(typeof t.fare?.amount === "number" && t.fare.amount > 0
      ? { fare: t.fare.amount }
      : {}),
    vehicleLabel: bus?.plateNumber ?? t.busType,
    crew: driver ? (driver.fullName ?? "Chưa có tên tài xế") : "Chưa phân công",
    driver: driver
      ? {
          id: driver.id,
          name: driver.fullName ?? "Chưa có tên tài xế",
          license: driver.licenseNumber ?? "",
          phone: driver.phone ?? "",
          expires: driver.licenseExpiresOn ?? "",
          avatarUrl:
            typeof driver.avatarUrl === "string" ? driver.avatarUrl : undefined,
        }
      : undefined,
    passengers: Math.max(0, capacity - (t.availableSeatCount ?? capacity)),
    capacity: Math.max(1, capacity),
    status: String(t.status).toLowerCase(),
    ...(typeof t.scheduleStatus === "string"
      ? { scheduleStatus: t.scheduleStatus.toLowerCase() }
      : {}),
    assignment: bus && driver ? "complete" : "missing",
  });
}
export async function getSchedule(
  signal?: AbortSignal,
): Promise<ScheduleTrip[]> {
  const [{ trips, buses, drivers }, pictures] = await Promise.all([
    scheduleResources(signal),
    tripPictures(signal),
  ]);
  const busIndex = new Map(buses.map((bus) => [bus.id, bus]));
  const driverIndex = new Map(drivers.map((driver) => [driver.id, driver]));
  return trips.map((t) => ({
    ...adaptSchedule(t, busIndex, driverIndex),
    photo: pictures[t.id],
  }));
}

export async function getSchedulePage(
  criteria: ScheduleCriteria,
  page: number,
  signal?: AbortSignal,
): Promise<{ items: ScheduleTrip[]; total: number; page: number }> {
  const query = new URLSearchParams({ size: "5" });
  for (const key of [
    "origin",
    "destination",
    "date",
    "sort",
    "scope",
  ] as const) {
    if (criteria[key]) query.set(key, criteria[key]);
  }
  for (const key of ["status", "period", "assignment"] as const) {
    for (const value of criteria[key]?.split(",").filter(Boolean) ?? [])
      query.append(key, value);
  }
  const fetchPage = (value: number): Promise<Row> => {
    query.set("page", String(value - 1));
    return request(
      `/api/v1/operator/trips/schedule?${query}`,
      "GET",
      undefined,
      signal,
    );
  };
  const [result, buses, drivers, pictures] = await Promise.all([
    fetchPage(page),
    rows("/api/v1/operator/buses", signal),
    getDriverResourceRows(signal),
    tripPictures(signal),
  ]);
  const actualPage = Math.min(page, Math.max(1, result.totalPages));
  const current = actualPage === page ? result : await fetchPage(actualPage);
  const busIndex = new Map(buses.map((bus) => [bus.id, bus]));
  const driverIndex = new Map(drivers.map((driver) => [driver.id, driver]));
  return {
    items: (current.items as Row[]).map((trip) => ({
      ...adaptSchedule(trip, busIndex, driverIndex),
      photo: pictures[trip.id],
    })),
    total: current.totalElements as number,
    page: actualPage,
  };
}
