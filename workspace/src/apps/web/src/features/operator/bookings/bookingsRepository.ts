import { rows, request, localDateTime, type Row } from "../liveOriginalApi";
import { bookingsResponseSchema, type BookingFilters } from "./bookings.schema";
import { apiJson } from "@/shared/api/client";
import { isMockApi } from "@/shared/api/config";

function bookingQuery(
  filters: Pick<BookingFilters, "from" | "to">,
): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  return query;
}

function mapBookings(bookings: Row[], trips: Row[]) {
  const tripsById = new Map(trips.map((trip) => [trip.id, trip]));
  return bookings.map((booking) => {
    const trip = tripsById.get(booking.tripId);
    const departure = trip ? localDateTime(trip.departureAt) : "";
    const confirmed = ["CONFIRMED", "PAID", "COMPLETED", "CHECKED_IN"].includes(
      booking.status,
    );
    const paid =
      ["PAID", "COMPLETED", "CHECKED_IN"].includes(booking.status) ||
      (booking.status === "CONFIRMED" &&
        booking.paymentChannel !== "PAY_LATER");
    return {
      id: booking.code,
      backendId: booking.id,
      name: booking.contact.fullName,
      phone: booking.contact.phone,
      tripId: booking.tripId,
      origin: trip?.origin ?? "—",
      destination: trip?.destination ?? "—",
      departureDate: departure.slice(0, 10),
      departureTime: departure.slice(11),
      createdDate: booking.createdAt
        ? localDateTime(booking.createdAt).slice(0, 10)
        : "",
      seat: (booking.seatCodes ?? booking.items.map(() => "—")).join(", "),
      amount: booking.total,
      status:
        booking.status === "CANCELLED"
          ? "cancelled"
          : confirmed
            ? "confirmed"
            : "pending",
      payment: paid ? "paid" : "unpaid",
      source: booking,
      trip,
    };
  });
}

export async function operatorBookingRows(
  range: Pick<BookingFilters, "from" | "to">,
  trips: Promise<Row[]>,
  signal?: AbortSignal,
) {
  const [bookings, tripRows] = await Promise.all([
    rows(`/api/v1/operator/bookings?${bookingQuery(range)}`, signal),
    trips,
  ]);
  return mapBookings(bookings, tripRows);
}

export async function getOperatorBookings(
  filters: BookingFilters,
  signal?: AbortSignal,
): Promise<import("zod").infer<typeof bookingsResponseSchema>> {
  if (isMockApi) {
    const query = new URLSearchParams({
      ...filters,
      page: String(filters.page),
    });
    return apiJson(
      `/api/v1/operator/bookings-preview?${query}`,
      bookingsResponseSchema,
      { signal },
    );
  }
  const pageSize = 10;
  const query = bookingQuery(filters);
  query.set("page", String(filters.page - 1));
  query.set("size", String(pageSize));
  if (filters.search) query.set("search", filters.search);
  if (filters.status !== "all") query.set("operatorStatus", filters.status);
  if (filters.payment !== "all") query.set("operatorPayment", filters.payment);

  const page = await request(
    `/api/v1/operator/bookings?${query}`,
    "GET",
    undefined,
    signal,
  );
  const bookings: Row[] = page.items;
  const tripQuery = new URLSearchParams();
  for (const id of new Set(bookings.map((booking) => booking.tripId))) {
    tripQuery.append("tripId", id);
  }
  const trips = bookings.length
    ? await rows(`/api/v1/operator/trips?${tripQuery}`, signal)
    : [];
  return bookingsResponseSchema.parse({
    items: mapBookings(bookings, trips),
    total: page.totalElements,
    page: filters.page,
    pageSize,
  });
}
