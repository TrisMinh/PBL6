import { rows, type Row } from "../liveOriginalApi";
import { operatorBookingRows } from "../bookings/bookingsRepository";
import {
  refundListSchema,
  refundLevel,
  cancellationMinutes,
  type RefundFilters,
  type RefundList,
} from "./refunds.schema";
export async function operatorRefundRows(signal?: AbortSignal): Promise<Row[]> {
  const [refunds, bookings, buses] = await Promise.all([
    rows("/api/v1/operator/refunds", signal),
    operatorBookingRows(signal),
    rows("/api/v1/operator/buses", signal),
  ]);
  return refunds.map((refund) => {
    const b = bookings.find((b) => b.backendId === refund.bookingId);
    if (!b) throw Error("Không tìm thấy đặt chỗ của hồ sơ hoàn tiền.");
    const bus = buses.find((bus) => bus.id === b.trip?.busId);
    return {
      bookingCode: b.id,
      customer: b.name,
      phone: b.phone,
      bookedTickets: b.source.items.length,
      seats: b.seat.split(/,\s*/),
      plate: bus?.plateNumber ?? "—",
      vehicleType: bus?.type ?? "—",
      tripCode: b.tripId,
      route: `${b.origin} → ${b.destination}`,
      requestedAt: refund.createdAt ?? "",
      departureAt: b.trip?.departureAt ?? "",
      status:
        refund.status === "SUCCEEDED"
          ? "completed"
          : refund.status === "FAILED"
            ? "exception"
            : refund.status === "PENDING"
              ? "pending"
              : "processing",
      cancelledTickets: b.status === "cancelled" ? b.source.items.length : 0,
      cancellationValue: refund.amount,
      paymentMethod: null,
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
      (!filters.date || r.requestedAt.startsWith(filters.date)) &&
      `${r.bookingCode} ${r.customer} ${r.phone}`
        .toLowerCase()
        .includes(filters.search.toLowerCase()),
  );
  return refundListSchema.parse({ items, total: items.length });
}
