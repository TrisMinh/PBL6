import { ApiError } from "@/shared/api/error";
import { isMockApi } from "@/shared/api/config";
import { apiJson } from "@/shared/api/client";
import { request, rows, type Row } from "../liveOriginalApi";
import {
  refundListSchema,
  refundLevel,
  cancellationMinutes,
  refundLocalTime,
  type RefundFilters,
  type RefundList,
} from "./refunds.schema";
function statusOf(
  refund: Row,
): "completed" | "exception" | "pending" | "processing" {
  if (refund.status === "SUCCEEDED") return "completed";
  if (["FAILED", "CANCELLED", "REJECTED"].includes(refund.status))
    return "exception";
  return ["PENDING", "REQUESTED"].includes(refund.status)
    ? "pending"
    : "processing";
}
const refundStatuses = {
  pending: "REQUESTED",
  processing: "PROCESSING",
  completed: "SUCCEEDED",
  exception: "FAILED",
} as const;
export async function operatorRefundRows(
  signal?: AbortSignal,
  filters?: RefundFilters,
  identifier?: string,
  page = 1,
): Promise<{ items: Row[]; total: number; page: number }> {
  const finance = new URLSearchParams();
  let directRefund: Row | undefined;
  if (identifier) {
    if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(identifier)) {
      try {
        directRefund = await request(
          `/api/v1/operator/refunds/${identifier}`,
          "GET",
          undefined,
          signal,
        );
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
        return { items: [], total: 0, page: 1 };
      }
    } else {
      const candidates = await rows(
        `/api/v1/operator/bookings?${new URLSearchParams({ search: identifier })}`,
        signal,
      );
      const booking = candidates.find((row) => row.code === identifier);
      if (!booking) return { items: [], total: 0, page: 1 };
      finance.set("bookingId", booking.id);
    }
  }
  if (filters?.date) finance.set("date", filters.date);
  if (filters && filters.status !== "all")
    finance.set("status", refundStatuses[filters.status]);
  const serverPaging =
    !identifier && filters && !filters.search && filters.level === "all";
  let total: number | undefined;
  let refunds: Row[];
  if (serverPaging) {
    const fetchPage = (index: number): Promise<Row> => {
      const query = new URLSearchParams(finance);
      query.set("page", String(index - 1));
      query.set("size", String(REFUND_PAGE_SIZE));
      return request(
        `/api/v1/operator/refunds?${query}`,
        "GET",
        undefined,
        signal,
      );
    };
    let response = await fetchPage(page);
    const validPage = Math.min(page, Math.max(1, response.totalPages));
    if (validPage !== page) {
      page = validPage;
      response = await fetchPage(page);
    }
    total = response.totalElements;
    refunds = response.items;
  } else {
    refunds = directRefund
      ? [directRefund]
      : await rows(`/api/v1/operator/refunds?${finance}`, signal);
  }
  refunds = refunds.filter(
    (refund) =>
      !filters ||
      ((filters.status === "all" || statusOf(refund) === filters.status) &&
        (!filters.date ||
          refundLocalTime(refund.createdAt).startsWith(filters.date))),
  );
  if (!refunds.length) return { items: [], total: total ?? 0, page: 1 };

  const ids = [...new Set(refunds.map((refund) => refund.bookingId as string))];
  const bookings = new Map<string, Row>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const query = new URLSearchParams();
    for (const id of ids.slice(offset, offset + 100))
      query.append("bookingId", id);
    for (const booking of await rows(
      `/api/v1/operator/bookings?${query}`,
      signal,
    ))
      bookings.set(booking.id, booking);
  }
  const matchedRefunds = refunds.flatMap((refund) => {
    const booking = bookings.get(refund.bookingId);
    if (!booking) throw Error("Không tìm thấy đặt chỗ của hồ sơ hoàn tiền.");
    const matches =
      !filters ||
      `${booking.code} ${booking.contact.fullName} ${booking.contact.phone}`
        .toLowerCase()
        .includes(filters.search.toLowerCase());
    return matches ? [{ refund, booking }] : [];
  });
  if (!matchedRefunds.length) return { items: [], total: 0, page: 1 };

  const tripIds = [
    ...new Set(
      matchedRefunds.map(({ booking }) => booking.tripId as string),
    ),
  ];
  const trips = new Map<string, Row>();
  const buses = new Map(
    (await rows("/api/v1/operator/buses", signal)).map((bus) => [bus.id, bus]),
  );
  for (let offset = 0; offset < tripIds.length; offset += 100) {
    const query = new URLSearchParams();
    for (const id of tripIds.slice(offset, offset + 100))
      query.append("tripId", id);
    for (const trip of await rows(`/api/v1/operator/trips?${query}`, signal))
      trips.set(trip.id, trip);
  }
  const matching = matchedRefunds.filter(({ refund, booking }) => {
    const trip = trips.get(booking.tripId);
    return (
      !filters ||
      filters.level === "all" ||
      (refund.createdAt &&
        refundLevel(
          cancellationMinutes(refund.createdAt, trip?.departureAt ?? ""),
        ) === filters.level)
    );
  });
  total ??= matching.length;
  page = Math.min(page, Math.max(1, Math.ceil(total / REFUND_PAGE_SIZE)));
  const visible =
    identifier || serverPaging
      ? matching
      : matching.slice((page - 1) * REFUND_PAGE_SIZE, page * REFUND_PAGE_SIZE);
  const ticketsByBooking = new Map<string, Row[]>();
  const visibleIds = [
    ...new Set(visible.map(({ refund }) => refund.bookingId as string)),
  ];
  for (let offset = 0; offset < visibleIds.length; offset += 100) {
    const query = new URLSearchParams();
    for (const id of visibleIds.slice(offset, offset + 100))
      query.append("bookingId", id);
    const seats = await rows(
      `/api/v1/operator/bookings/cancelled-seats?${query}`,
      signal,
    );
    for (const seat of seats) {
      const existing = ticketsByBooking.get(seat.bookingId);
      if (existing) existing.push(seat);
      else ticketsByBooking.set(seat.bookingId, [seat]);
    }
  }
  const items = visible
    .sort(
      (a, b) => Date.parse(b.refund.createdAt) - Date.parse(a.refund.createdAt),
    )
    .map(({ refund, booking: b }) => {
      const trip = trips.get(b.tripId);
      const bus = buses.get(trip?.busId);
      const cancelled = ticketsByBooking.get(b.id) ?? [];
      return {
        refundId: refund.id,
        bookingCode: b.code,
        customer: b.contact.fullName,
        phone: b.contact.phone,
        bookedTickets: b.items.length,
        seats: cancelled.map((ticket) => ticket.seatCode),
        plate: bus?.plateNumber ?? "—",
        vehicleType: bus?.type ?? "—",
        tripCode: b.tripId,
        route: trip ? `${trip.origin} → ${trip.destination}` : "—",
        requestedAt: refund.createdAt ?? "",
        departureAt: trip?.departureAt ?? "",
        status: statusOf(refund),
        cancelledTickets: cancelled.length,
        cancellationValue: null,
        recordedRefundAmount: refund.amount,
        paymentMethod:
          b.paymentChannel === "PREPAID" ? "Thanh toán trực tuyến" : null,
        refundReference: refund.refundReference,
        progressLayout: "standard",
        source: refund,
      };
    });
  return { items, total, page };
}
export const REFUND_PAGE_SIZE = 20;
export async function getRefundRequests(
  filters: RefundFilters,
  signal?: AbortSignal,
  page = 1,
): Promise<RefundList & { page: number }> {
  if (isMockApi) {
    const result = await apiJson(
      `/api/v1/operator/refund-requests-preview?${new URLSearchParams(filters)}`,
      refundListSchema,
      { signal },
    );
    return { ...result, page: 1 };
  }
  const result = await operatorRefundRows(signal, filters, undefined, page);
  return { ...refundListSchema.parse(result), page: result.page };
}
