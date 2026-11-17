import { request, type Row } from "../liveOriginalApi";
import {
  scheduleResources,
  adaptSchedule,
} from "../schedule/scheduleRepository";
import {
  tripListsResponseSchema,
  tripPassengersResponseSchema,
  type TripListFilters,
  type ManifestPassenger,
  type TripPassengersResponse,
} from "./tripLists.schema";
function tripRow(
  t: Row,
  buses: Row[],
  drivers: Row[],
  passengers: Row[] = [],
): Row {
  const s = adaptSchedule(t, buses, drivers);
  return {
    ...s,
    vehicle: s.vehicleLabel,
    booked: passengers.length || s.passengers,
    checkedIn: passengers.filter((p) => p.status === "CHECKED_IN").length,
    status: s.status === "draft" ? "scheduled" : s.status,
  };
}
export async function getPassengerTrips(
  filters: TripListFilters,
  signal?: AbortSignal,
): Promise<import("zod").infer<typeof tripListsResponseSchema>> {
  const { trips, buses, drivers } = await scheduleResources(signal);
  const items = await Promise.all(
    trips
      .filter((t) => t.status !== "DRAFT" && t.status !== "CANCELLED")
      .map(async (t) => {
        const manifest = await request(
          `/api/v1/operator/trips/${t.id}/manifest`,
          "GET",
          undefined,
          signal,
        );
        return tripRow(t, buses, drivers, manifest.passengers);
      }),
  );
  const routes = [
    ...new Set(items.map((t) => `${t.origin} → ${t.destination}`)),
  ];
  return tripListsResponseSchema.parse({
    items: items.filter(
      (t) =>
        (!filters.date || t.date === filters.date) &&
        (filters.status === "all" || t.status === filters.status) &&
        (filters.route === "all" ||
          `${t.origin} → ${t.destination}` === filters.route) &&
        `${t.id} ${t.origin} ${t.destination} ${t.vehicle}`
          .toLowerCase()
          .includes(filters.search.toLowerCase()),
    ),
    routes,
  });
}
export async function getPassengerTrip(
  id: string,
  signal?: AbortSignal,
): Promise<TripPassengersResponse["trip"]> {
  const { trips, buses, drivers } = await scheduleResources(signal);
  const trip = trips.find((item) => item.id === id);
  if (!trip) throw Error("Không tìm thấy chuyến này.");

  const driver = drivers.find((item) => item.id === trip.driverId);
  return tripPassengersResponseSchema.shape.trip.parse({
    ...tripRow(trip, buses, drivers),
    driver: driver?.fullName ?? driver?.licenseNumber ?? "Chưa phân công",
  });
}

export async function getTripPassengers(
  id: string,
  signal?: AbortSignal,
): Promise<ManifestPassenger[]> {
  const manifest = await request(
    `/api/v1/operator/trips/${id}/manifest`,
    "GET",
    undefined,
    signal,
  );
  return tripPassengersResponseSchema.shape.passengers.parse(
    manifest.passengers.map((p: Row) => ({
      name: p.passengerName,
      phone: "",
      seat: p.seatCode,
      pickup: p.pickupStopName,
      confirmed: p.status !== "CANCELLED",
      ticketCode: p.ticketId,
      payment: p.paymentChannel === "PAY_LATER" ? "unpaid" : "paid",
      boardingStatus:
        p.status === "CHECKED_IN"
          ? "checked-in"
          : p.status === "ISSUED"
            ? "confirmed"
            : "waiting",
    })),
  );
}
