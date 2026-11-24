import { rows, request, type Row } from "../liveOriginalApi";
import {
  scheduleResources,
  adaptSchedule,
} from "../schedule/scheduleRepository";
import {
  tripDetailSchema,
  tripEditSchema,
  type TripDetail,
} from "./detail.schema";
export async function readTrip(
  id: string,
  signal?: AbortSignal,
): Promise<TripDetail> {
  const { trips, buses, drivers } = await scheduleResources(signal, id);
  const t = trips.find((v) => v.id === id);
  if (!t) throw Error("Không tìm thấy chuyến");
  const bus = buses.find((v) => v.id === t.busId),
    driver = drivers.find((v) => v.id === t.driverId);
  const manifest =
    t.status === "DRAFT"
      ? { passengers: [] }
      : await request(
          `/api/v1/operator/trips/${id}/manifest`,
          "GET",
          undefined,
          signal,
        );
  return tripDetailSchema.parse({
    ...adaptSchedule(t, buses, drivers),
    rowVersion: t.rowVersion,
    vehicle: bus?.plateNumber ?? "Chưa phân công",
    driver: driver?.fullName ?? driver?.licenseNumber ?? "Chưa phân công",
    assistant: "",
    pickup: t.stops.find((s: Row) => s.pickupAllowed)?.name ?? t.origin,
    dropoff:
      [...t.stops].reverse().find((s: Row) => s.dropoffAllowed)?.name ??
      t.destination,
    note: "",
    passengerList: manifest.passengers.map((p: Row) => ({
      name: p.passengerName,
      phone: "",
      seat: p.seatCode,
      pickup: p.pickupStopName,
      confirmed: p.status !== "CANCELLED",
    })),
    vehicleOptions: buses.map((v) => v.plateNumber),
    driverOptions: drivers.map((v) => v.fullName ?? v.licenseNumber),
  });
}
export async function cancelTrip(
  id: string,
  expectedVersion: number,
  reason: string,
): Promise<void> {
  await request(`/api/v1/operator/trips/${id}/cancel`, "POST", {
    expectedVersion,
    reason,
  });
}
export async function updateTrip(
  id: string,
  input: unknown,
): Promise<TripDetail> {
  const value = tripEditSchema.parse(input);
  const { trips, buses, drivers } = await scheduleResources(undefined, id);
  const t = trips.find((v) => v.id === id);
  if (!t) throw Error("Không tìm thấy chuyến");
  if (t.status !== "DRAFT") throw Error("Chỉ có thể chỉnh sửa chuyến nháp.");
  const routes = await rows("/api/v1/operator/routes");
  const route = routes.find(
    (r) => r.origin === value.origin && r.destination === value.destination,
  );
  const bus = buses.find((v) => v.plateNumber === value.vehicle),
    driver = drivers.find(
      (v) => (v.fullName ?? v.licenseNumber) === value.driver,
    );
  if (!route || !bus || !driver)
    throw Error("Chọn tuyến, xe và tài xế đang có trong nhà xe.");
  if (value.assistant || value.note)
    throw Error("Ghi chú và phụ xe chưa được hỗ trợ trên chuyến này.");
  const departureAt = new Date(
    `${value.date}T${value.departure}:00+07:00`,
  ).toISOString();
  const duration = Date.parse(t.arrivalAt) - Date.parse(t.departureAt);
  await request(`/api/v1/operator/trips/${id}`, "PATCH", {
    routeId: route.id,
    busId: bus.id,
    driverId: driver.id,
    departureAt,
    arrivalAt: new Date(Date.parse(departureAt) + duration).toISOString(),
    fare: t.fare,
    policyVersion: t.policyVersion,
    expectedVersion: t.rowVersion,
  });
  return readTrip(id);
}
