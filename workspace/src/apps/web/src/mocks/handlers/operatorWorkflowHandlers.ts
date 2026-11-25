import { http, HttpResponse } from "msw";
import { z } from "zod";
import { readMockOperatorRoutes } from "./operatorRouteHandlers";
import { readMockOperatorVehicles } from "./operatorVehicleHandlers";
import { readMockOperatorDrivers } from "./operatorDriverHandlers";
import {
  vehicleSeatCodes,
  VEHICLE_TYPES,
} from "@/features/operator/vehicles/vehicles.schema";
import { tripSchema, type Trip } from "@/features/operator/tripWorkflow";
import type { ScheduleTrip } from "@/features/operator/schedule/schedule.schema";
import { scheduleConflicts } from "@/features/operator/tripAvailability";
import { recurringDates } from "@/features/operator/create/tripRecurrence";

const KEY = "blue-operator-workflow-trips-v1";
const inputSchema = z.object({
  routeId: z.string(),
  busId: z.string(),
  driverId: z.string(),
  departureAt: z.iso.datetime({ offset: true }),
  arrivalAt: z.iso.datetime({ offset: true }),
  fare: z.object({
    amount: z.number().int().positive(),
    currency: z.literal("VND"),
  }),
  expectedVersion: z.number().int().nonnegative(),
  policyVersion: z.string(),
});
function routes(): z.infer<
  typeof import("@/features/operator/tripWorkflow").routeSchema
>[] {
  return readMockOperatorRoutes().map((r) => ({
    id: r.id,
    name: `${r.origin} → ${r.destination}`,
    origin: r.origin,
    destination: r.destination,
    status: r.status === "active" ? "ACTIVE" : "INACTIVE",
    durationMinutes: r.hours * 60,
    stops: r.stops.map((s, i) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      sequence: i,
      offsetMinutes: Math.round(
        (s.km / Math.max(r.distance, 1)) * r.hours * 60,
      ),
      pickupAllowed: s.kind !== "dropoff",
      dropoffAllowed: s.kind !== "pickup",
    })),
  }));
}
function buses(): z.infer<
  typeof import("@/features/operator/tripWorkflow").busSchema
>[] {
  return readMockOperatorVehicles().map((v) => ({
    id: v.id,
    plateNumber: v.plate,
    type: VEHICLE_TYPES[v.type].name,
    status: "ACTIVE",
    seats: vehicleSeatCodes(
      v.type,
      v.rearSeats,
      v.cabinCapacity,
      v.lowerRooms,
    ).map((code) => ({ code, enabled: !v.disabledSeats.includes(code) })),
  }));
}
function drivers(): z.infer<
  typeof import("@/features/operator/tripWorkflow").driverSchema
>[] {
  return readMockOperatorDrivers().map((d) => ({
    id: d.id,
    userId: d.id,
    fullName: d.name,
    licenseNumber: d.licenseNumber,
    licenseExpiresOn: d.expiresAt,
    status: d.status === "paused" ? "INACTIVE" : "ACTIVE",
  }));
}
export function readMockWorkflowTrips(): Trip[] {
  try {
    return z
      .array(tripSchema)
      .parse(JSON.parse(sessionStorage.getItem(KEY) ?? "[]"));
  } catch {
    return [];
  }
}
function storeTrips(trips: Trip[]): void {
  sessionStorage.setItem(KEY, JSON.stringify(trips));
}
function localParts(value: string): { date: string; time: string } {
  const local = new Date(Date.parse(value) + 7 * 3600000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}
export function mockWorkflowSchedule(): ScheduleTrip[] {
  return readMockWorkflowTrips().map((t) => {
    const bus = buses().find((b) => b.id === t.busId),
      driver = drivers().find((d) => d.id === t.driverId),
      departure = localParts(t.departureAt);
    return {
      id: t.id,
      origin: t.origin,
      destination: t.destination,
      date: departure.date,
      departure: departure.time,
      arrival: localParts(t.arrivalAt).time,
      vehicleLabel: bus?.type ?? "Chưa chọn xe",
      crew: `Xe ${bus?.plateNumber ?? "—"} · ${driver?.fullName ?? "Chưa phân công"}`,
      passengers: 0,
      capacity: bus?.seats.length ?? 1,
      status: t.status === "DRAFT" ? "draft" : "scheduled",
      assignment: bus && driver ? "complete" : "missing",
    };
  });
}
const error = (message: string, status = 400): Response =>
  HttpResponse.json({ message }, { status });
function conflict(
  trip: Pick<Trip, "busId" | "driverId" | "departureAt" | "arrivalAt">,
  id = "",
): boolean {
  return readMockWorkflowTrips().some(
    (t) =>
      t.id !== id &&
      t.status !== "DRAFT" &&
      (t.busId === trip.busId || t.driverId === trip.driverId) &&
      Date.parse(trip.departureAt) < Date.parse(t.arrivalAt) + 3600000 &&
      Date.parse(t.departureAt) < Date.parse(trip.arrivalAt) + 3600000,
  );
}
export const operatorWorkflowHandlers = [
  http.get("/api/v1/operator/routes", () =>
    HttpResponse.json({ items: routes(), totalPages: 1 }),
  ),
  http.get("/api/v1/operator/buses", () =>
    HttpResponse.json({ items: buses(), totalPages: 1 }),
  ),
  http.get("/api/v1/operator/drivers", () =>
    HttpResponse.json({ items: drivers(), totalPages: 1 }),
  ),
  http.get("/api/v1/operator/trips", () =>
    HttpResponse.json({ items: readMockWorkflowTrips(), totalPages: 1 }),
  ),
  http.post(
    "/api/v1/operator/trips/assignment-availability",
    async ({ request }) => {
      const parsed = inputSchema
        .pick({ departureAt: true, arrivalAt: true })
        .extend({
          endDate: z.iso.date().optional(),
          weekdays: z.array(z.number().int().min(0).max(6)).optional(),
        })
        .safeParse(await request.json());
      if (!parsed.success) return error("Thông tin giờ chạy chưa hợp lệ.");
      const { departureAt, arrivalAt, endDate, weekdays } = parsed.data;
      const first = localParts(departureAt).date;
      const dates = endDate
        ? recurringDates(first, {
            enabled: true,
            endDate,
            days: weekdays ?? [],
          })
        : [first];
      const start = Date.parse(departureAt),
        end = Date.parse(arrivalAt);
      const last = dates.at(-1);
      if (
        end <= start ||
        !last ||
        dates.some(
          (date, index) =>
            index > 0 &&
            Date.parse(date) - Date.parse(dates[index - 1]) <
              end - start + 7_200_000,
        )
      )
        return error("Lịch chạy không hợp lệ.");
      const trips = readMockWorkflowTrips();
      const conflicts = dates.map((date) => {
        const offset = Date.parse(date) - Date.parse(first);
        return scheduleConflicts(trips, [start + offset, end + offset]);
      });
      const lastArrival = new Date(
        end + Date.parse(last) - Date.parse(first),
      )
        .toISOString()
        .slice(0, 10);
      return HttpResponse.json({
        busIds: buses()
          .filter(
            (bus) =>
              bus.status === "ACTIVE" &&
              bus.seats.some((seat) => seat.enabled) &&
              conflicts.every((slot) => !slot.buses.has(bus.id)),
          )
          .map((bus) => bus.id),
        driverIds: drivers()
          .filter(
            (driver) =>
              driver.status === "ACTIVE" &&
              driver.licenseExpiresOn >= lastArrival &&
              conflicts.every((slot) => !slot.drivers.has(driver.id)),
          )
          .map((driver) => driver.id),
      });
    },
  ),
  http.post("/api/v1/operator/trips", async ({ request }) => {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return error("Thông tin chuyến chưa hợp lệ.");
    const input = parsed.data,
      route = routes().find((r) => r.id === input.routeId),
      bus = buses().find((b) => b.id === input.busId),
      driver = drivers().find((d) => d.id === input.driverId);
    if (
      !route ||
      !bus ||
      !driver ||
      route.status !== "ACTIVE" ||
      driver.status !== "ACTIVE" ||
      !bus.seats.some((s) => s.enabled)
    )
      return error("Nguồn lực không còn khả dụng.", 409);
    if (Date.parse(input.arrivalAt) <= Date.parse(input.departureAt))
      return error("Giờ đến phải sau giờ đi.");
    const trip: Trip = {
      ...input,
      id: `BL-${1001 + readMockWorkflowTrips().length}`,
      organizationId: "blue-line-demo",
      origin: route.origin,
      destination: route.destination,
      status: "DRAFT",
      sellable: false,
      rowVersion: 0,
      stops: route.stops,
    };
    storeTrips([...readMockWorkflowTrips(), trip]);
    return HttpResponse.json(trip, { status: 201 });
  }),
  http.patch("/api/v1/operator/trips/:tripId", async ({ params, request }) => {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return error("Thông tin chuyến chưa hợp lệ.");
    const all = readMockWorkflowTrips(),
      previous = all.find((t) => t.id === params.tripId),
      input = parsed.data;
    if (!previous) return error("Không tìm thấy chuyến.", 404);
    if (previous.rowVersion !== input.expectedVersion)
      return error("Dữ liệu chuyến đã thay đổi.", 409);
    if (previous.status !== "DRAFT")
      return error("Chỉ sửa được chuyến nháp.", 409);
    const route = routes().find((r) => r.id === input.routeId);
    if (
      !route ||
      !buses().some((b) => b.id === input.busId) ||
      !drivers().some((d) => d.id === input.driverId)
    )
      return error("Nguồn lực không tồn tại.");
    if (Date.parse(input.arrivalAt) <= Date.parse(input.departureAt))
      return error("Giờ đến phải sau giờ đi.");
    const trip: Trip = {
      ...previous,
      ...input,
      origin: route.origin,
      destination: route.destination,
      stops: route.stops,
      rowVersion: previous.rowVersion + 1,
    };
    storeTrips(all.map((t) => (t.id === trip.id ? trip : t)));
    return HttpResponse.json(trip);
  }),
  http.post(
    "/api/v1/operator/trips/:tripId/publish",
    async ({ params, request }) => {
      const body = z
        .object({ expectedVersion: z.number() })
        .safeParse(await request.json());
      if (!body.success) return error("Thiếu phiên bản chuyến.");
      const all = readMockWorkflowTrips(),
        trip = all.find((t) => t.id === params.tripId);
      if (!trip) return error("Không tìm thấy chuyến.", 404);
      if (trip.rowVersion !== body.data.expectedVersion)
        return error("Dữ liệu chuyến đã thay đổi.", 409);
      if (trip.status !== "DRAFT")
        return error("Chuyến đã được phát hành.", 409);
      if (conflict(trip, trip.id))
        return error(
          "Xe hoặc tài xế trùng lịch; cần cách chuyến trước ít nhất 60 phút.",
          409,
        );
      const driver = drivers().find((d) => d.id === trip.driverId);
      if (
        !driver ||
        driver.status !== "ACTIVE" ||
        driver.licenseExpiresOn < trip.arrivalAt.slice(0, 10)
      )
        return error("Tài xế hoặc GPLX không còn hợp lệ.", 409);
      const saved = {
        ...trip,
        status: "SCHEDULED",
        sellable: true,
        rowVersion: trip.rowVersion + 1,
      };
      storeTrips(all.map((t) => (t.id === trip.id ? saved : t)));
      return HttpResponse.json(saved);
    },
  ),
  http.get("/api/v1/trips/:tripId", ({ params }) => {
    const trip = readMockWorkflowTrips().find((t) => t.id === params.tripId);
    return trip ? HttpResponse.json(trip) : undefined;
  }),
];
