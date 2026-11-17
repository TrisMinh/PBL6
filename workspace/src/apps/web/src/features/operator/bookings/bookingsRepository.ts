import { rows, request, localDateTime, type Row } from "../liveOriginalApi";
import { bookingsResponseSchema, type BookingFilters } from "./bookings.schema";
import { ApiError } from "@/shared/api/error";
export async function operatorBookingRows(
  signal?: AbortSignal,
): Promise<Row[]> {
  const [bookings, trips] = await Promise.all([
    rows("/api/v1/operator/bookings", signal),
    rows("/api/v1/operator/trips", signal),
  ]);
  const inventories = new Map<string, Promise<Row>>();
  const inventoryFor = (tripId: string): Promise<Row> => {
    let inventory = inventories.get(tripId);
    if (!inventory) {
      inventory = request(
        `/api/v1/trips/${tripId}/seats`,
        "GET",
        undefined,
        signal,
      ).catch((error) => {
        if (error instanceof ApiError && error.status === 404)
          return { seats: [] };
        throw error;
      });
      inventories.set(tripId, inventory);
    }
    return inventory;
  };
  return Promise.all(
    bookings.map(async (b) => {
      const t = trips.find((t) => t.id === b.tripId);
      const inventory = await inventoryFor(b.tripId);
      const departure = t ? localDateTime(t.departureAt) : "";
      return {
        id: b.code,
        backendId: b.id,
        name: b.contact.fullName,
        phone: b.contact.phone,
        tripId: b.tripId,
        origin: t?.origin ?? "—",
        destination: t?.destination ?? "—",
        departureDate: departure.slice(0, 10),
        departureTime: departure.slice(11),
        createdDate: b.createdAt ? localDateTime(b.createdAt).slice(0, 10) : "",
        seat: b.items
          .map(
            (p: Row) =>
              inventory.seats.find((s: Row) => s.id === p.seatId)?.code ?? "—",
          )
          .join(", "),
        amount: b.total,
        status:
          b.status === "CANCELLED"
            ? "cancelled"
            : ["CONFIRMED", "PAID", "COMPLETED", "CHECKED_IN"].includes(
                  b.status,
                )
              ? "confirmed"
              : "pending",
        payment:
          b.status === "CANCELLED"
            ? "unpaid"
            : ["PAID", "COMPLETED", "CHECKED_IN"].includes(b.status) ||
                (b.status === "CONFIRMED" && b.paymentChannel !== "PAY_LATER")
              ? "paid"
              : "unpaid",
        source: b,
        trip: t,
      };
    }),
  );
}
export async function getOperatorBookings(
  filters: BookingFilters,
  signal?: AbortSignal,
): Promise<import("zod").infer<typeof bookingsResponseSchema>> {
  const items = (await operatorBookingRows(signal)).filter(
    (b) =>
      (!b.createdDate ||
        ((!filters.from || b.createdDate >= filters.from) &&
          (!filters.to || b.createdDate <= filters.to))) &&
      (filters.status === "all" || b.status === filters.status) &&
      (filters.payment === "all" || b.payment === filters.payment) &&
      `${b.id} ${b.name} ${b.phone}`
        .toLowerCase()
        .includes(filters.search.toLowerCase()),
  );
  return bookingsResponseSchema.parse({
    items: items.slice((filters.page - 1) * 10, filters.page * 10),
    total: items.length,
    page: filters.page,
    pageSize: 10,
  });
}
