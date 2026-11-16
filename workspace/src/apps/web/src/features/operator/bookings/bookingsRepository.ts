import { z as zod } from "zod";
import { apiJson } from "@/shared/api/client";
import { isMockApi } from "@/shared/api/config";
import { getLiveRows } from "@/shared/api/liveRequest";
import { vietnamParts } from "../schedule/scheduleRepository";
import type { OperatorBooking } from "./bookings.schema";
async function liveBookings(
  filters: BookingFilters,
  signal?: AbortSignal,
): Promise<z.infer<typeof bookingsResponseSchema>> {
  const [bookings, trips] = await Promise.all([
    getLiveRows("/api/v1/operator/bookings", signal),
    getLiveRows("/api/v1/operator/trips", signal),
  ]);
  const tripIds = [...new Set(bookings.map((b) => String(b.tripId)))];
  const seatsByTrip = new Map(
    await Promise.all(
      tripIds.map(async (id) => {
        const result = await apiJson(
          `/api/v1/trips/${encodeURIComponent(id)}/seats`,
          zod.object({
            seats: zod.array(
              zod.object({ id: zod.string(), code: zod.string() }),
            ),
          }),
          { signal },
        );
        return [id, new Map(result.seats.map((s) => [s.id, s.code]))] as const;
      }),
    ),
  );
  const items: OperatorBooking[] = bookings.flatMap((row) => {
    const trip = trips.find((t) => t.id === row.tripId);
    if (!trip) return [];
    const contact =
      typeof row.contact === "object" && row.contact
        ? (row.contact as Record<string, unknown>)
        : {};
    const parts = vietnamParts(trip.departureAt);
    const seats = Array.isArray(row.items)
      ? (row.items as Record<string, unknown>[])
      : [];
    return [
      {
        id: String(row.id),
        code: String(row.code),
        name: String(contact.fullName ?? "—"),
        phone: String(contact.phone ?? ""),
        tripId: String(row.tripId),
        origin: String(trip.origin),
        destination: String(trip.destination),
        departureDate: parts.date,
        departureTime: parts.time,
        createdDate:
          typeof row.createdAt === "string"
            ? vietnamParts(row.createdAt).date
            : "",
        seat: seats
          .map((i) =>
            String(
              i.seatCode ??
                seatsByTrip.get(String(row.tripId))?.get(String(i.seatId)) ??
                "—",
            ),
          )
          .join(", "),
        amount: Number(row.total),
        status: ["CANCELLED", "EXPIRED"].includes(String(row.status))
          ? "cancelled"
          : ["PAID", "COMPLETED", "CONFIRMED"].includes(String(row.status))
            ? "confirmed"
            : "pending",
        payment: ["PAID", "COMPLETED"].includes(String(row.status))
          ? "paid"
          : "unpaid",
      },
    ];
  });
  const filtered = items.filter(
    (i) =>
      (filters.status === "all" || i.status === filters.status) &&
      (filters.payment === "all" || i.payment === filters.payment) &&
      i.departureDate >= filters.from &&
      i.departureDate <= filters.to &&
      JSON.stringify(i)
        .toLocaleLowerCase("vi")
        .includes(filters.search.toLocaleLowerCase("vi")),
  );
  return {
    items: filtered.slice((filters.page - 1) * 9, filters.page * 9),
    total: filtered.length,
    page: filters.page,
    pageSize: 9,
  };
}
import { apiFetch as fetch } from "@/shared/api/client";
import type { z } from "zod";
import { bookingsResponseSchema, type BookingFilters } from "./bookings.schema";
export async function getOperatorBookings(
  filters: BookingFilters,
  signal?: AbortSignal,
): Promise<z.infer<typeof bookingsResponseSchema>> {
  if (!isMockApi) return liveBookings(filters, signal);
  const params = new URLSearchParams(
    Object.entries(filters).map(([key, value]) => [key, String(value)]),
  );
  const response = await fetch(`/api/v1/operator/bookings-preview?${params}`, {
    signal,
  });
  if (!response.ok)
    throw Error("Không tải được danh sách đặt chỗ. Vui lòng thử lại.");
  return bookingsResponseSchema.parse(await response.json());
}
