import { request, rows, type Row } from "../liveOriginalApi";
import {
  refundListSchema,
  refundLevel,
  cancellationMinutes,
  refundLocalTime,
  type RefundFilters,
  type RefundList,
} from "./refunds.schema";
export async function operatorRefundRows(signal?: AbortSignal): Promise<Row[]> {
  const [refunds, bookings, trips, buses] = await Promise.all([
    rows("/api/v1/operator/refunds", signal),
    rows("/api/v1/operator/bookings", signal),
    rows("/api/v1/operator/trips", signal),
    rows("/api/v1/operator/buses", signal),
  ]);
  const ids = [...new Set(refunds.map((refund) => refund.bookingId as string))];
  const ticketsByBooking = new Map<string, Row[]>();
  for (let offset = 0; offset < ids.length; offset += 8) {
    await Promise.all(
      ids.slice(offset, offset + 8).map(async (id) => {
        const tickets = await request(
          `/api/v1/bookings/${encodeURIComponent(id)}/tickets`,
          "GET",
          undefined,
          signal,
        );
        ticketsByBooking.set(id, tickets as Row[]);
      }),
    );
  }
  return [...refunds]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((refund) => {
      const b = bookings.find((b) => b.id === refund.bookingId);
      if (!b) throw Error("Không tìm thấy đặt chỗ của hồ sơ hoàn tiền.");
      const trip = trips.find((item) => item.id === b.tripId);
      const bus = buses.find((bus) => bus.id === trip?.busId);
      const cancelled = (ticketsByBooking.get(b.id) ?? []).filter((ticket) =>
        ["CANCELLED", "REFUNDED"].includes(ticket.status),
      );
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
        status:
          refund.status === "SUCCEEDED"
            ? "completed"
            : ["FAILED", "CANCELLED", "REJECTED"].includes(refund.status)
              ? "exception"
              : ["PENDING", "REQUESTED"].includes(refund.status)
                ? "pending"
                : "processing",
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
}
export async function getRefundRequests(
  filters: RefundFilters,
  signal?: AbortSignal,
): Promise<RefundList> {
  const items = (await operatorRefundRows(signal)).filter(
    (r) =>
      (filters.status === "all" || r.status === filters.status) &&
      (filters.level === "all" ||
        (r.requestedAt &&
          refundLevel(cancellationMinutes(r.requestedAt, r.departureAt)) ===
            filters.level)) &&
      (!filters.date ||
        refundLocalTime(r.requestedAt).startsWith(filters.date)) &&
      `${r.bookingCode} ${r.customer} ${r.phone}`
        .toLowerCase()
        .includes(filters.search.toLowerCase()),
  );
  return refundListSchema.parse({ items, total: items.length });
}
