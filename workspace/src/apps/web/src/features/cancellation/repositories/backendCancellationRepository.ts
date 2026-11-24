import { readApiSession } from "@/shared/api/session";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { backendTicketSchema, bookingSchema } from "@/shared/api/contracts";
import { ApiError } from "@/shared/api/error";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import {
  hydrateBackendTicket,
  ownedBooking,
  ticketDetail,
} from "@/features/tickets/repositories/backendTicketRepository";
import type { CancellationRepository } from "./cancellationRepository";

export const cancellationPreviewSchema = z.object({
  previewId: z.string(),
  ticketIds: z.array(z.string()),
  policyVersion: z.string(),
  fee: z.number(),
  refundAmount: z.number(),
  expiresAt: z.string(),
});
const previews = new Map<
  string,
  { quote: z.infer<typeof cancellationPreviewSchema>; version: number }
>();
const previewKey = (bookingId: string, ticketIds: readonly string[]): string =>
  `${readApiSession()?.user.id ?? ""}:${bookingId}:${[...ticketIds].sort().join(",")}`;
export async function getCancellationPreview(
  code: string,
  ticketIds: readonly string[],
  signal?: AbortSignal,
): Promise<z.infer<typeof cancellationPreviewSchema>> {
  const booking = await ownedBooking(code, signal);
  return requestCancellationPreview(booking, ticketIds, signal);
}

async function requestCancellationPreview(
  booking: z.infer<typeof bookingSchema>,
  ticketIds: readonly string[],
  signal?: AbortSignal,
): Promise<z.infer<typeof cancellationPreviewSchema>> {
  const quote = await apiJson(
    `/api/v1/bookings/${booking.id}/cancellation-preview`,
    cancellationPreviewSchema,
    { method: "POST", body: { ticketIds }, signal },
  );
  previews.set(previewKey(booking.id, ticketIds), {
    quote,
    version: booking.rowVersion,
  });
  return quote;
}
const time = (value: string): string =>
  new Date(value).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  });
export const backendCancellationRepository: CancellationRepository = {
  getOptions: async (code, _access, signal) => {
    const booking = await ownedBooking(code, signal);
    const all = await apiJson(
      `/api/v1/bookings/${booking.id}/tickets`,
      z.array(backendTicketSchema),
      { signal },
    );
    const issued = all.filter((ticket) => ticket.status === "ISSUED");
    if (!issued.length)
      throw new ApiError(
        "NO_CANCELLABLE_TICKETS",
        409,
        "Không còn vé có thể hủy.",
      );

    // Booking remains the source of eligibility even when trip details are no longer public.
    const quote = await requestCancellationPreview(
      booking,
      issued.map((ticket) => ticket.id),
      signal,
    );
    const trip = await getBackendTrip(booking.tripId, signal);
    const tickets = await Promise.all(
      issued.map((ticket) =>
        ticket.journey
          ? ticketDetail(ticket, booking.code, ticket.journey, trip)
          : hydrateBackendTicket(ticket, signal),
      ),
    );
    const pickup = trip.stops.find(
      (s) => s.id === booking.items[0]?.pickupStopId,
    );
    const dropoff = trip.stops.find(
      (s) => s.id === booking.items[0]?.dropoffStopId,
    );
    const minutes = Math.round(
      (Date.parse(trip.arrivalAt) - Date.parse(trip.departureAt)) / 60000,
    );
    const fare = quote.fee + quote.refundAmount;
    const feeRatePercent = fare ? (quote.fee / fare) * 100 : 0;
    return {
      bookingId: booking.id,
      bookingCode: booking.code,
      tickets,
      ticketPresentations: tickets.map((t) => ({
        ticketId: t.ticketId,
        maskedPhone: booking.contact.phone.replace(/.(?=.{4})/g, "*"),
      })),
      latestRefund: null,
      refundRatePercent: fare ? 100 - feeRatePercent : 0,
      feeRatePercent,
      policyLabel: `Chính sách ${quote.policyVersion}`,
      journey: {
        operatorName: trip.operatorName,
        tripCode: trip.id,
        departureTime: time(trip.departureAt),
        arrivalTime: time(trip.arrivalAt),
        originCity: trip.origin,
        originStop: pickup?.name ?? trip.origin,
        destinationCity: trip.destination,
        destinationStop: dropoff?.name ?? trip.destination,
        durationLabel: `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`,
        serviceDateLabel: new Date(trip.departureAt).toLocaleDateString(
          "vi-VN",
          { timeZone: "Asia/Ho_Chi_Minh" },
        ),
        pickupTitle: pickup?.name ?? trip.origin,
        pickupAddress: pickup?.address ?? pickup?.name ?? trip.origin,
        checkInLabel: "Theo giờ khởi hành",
        requestedAtLabel: "Chưa xác nhận",
        recordedAtLabel: "Chưa xác nhận",
      },
    };
  },
  cancel: async (code, ticketIds, key, _access, signal) => {
    const booking = await ownedBooking(code, signal);
    const reviewed = previews.get(previewKey(booking.id, ticketIds));
    if (!reviewed || Date.parse(reviewed.quote.expiresAt) <= Date.now())
      throw new ApiError("PREVIEW_STALE", 410, "Báo phí hủy đã hết hiệu lực.");
    const preview = reviewed.quote;
    const result = await apiJson(
      `/api/v1/bookings/${booking.id}/cancel`,
      z.object({
        operationId: z.string(),
        status: z.string(),
        acceptedAt: z.string(),
      }),
      {
        method: "POST",
        idempotencyKey: key,
        body: {
          previewId: preview.previewId,
          reason: "Khách hàng yêu cầu hủy vé",
          expectedVersion: reviewed.version,
        },
        signal,
      },
    );
    const tickets = await apiJson(
      `/api/v1/bookings/${booking.id}/tickets`,
      z.array(backendTicketSchema),
      { signal },
    );
    // This is the real cancellation operation receipt. Refund settlement is asynchronous.
    return {
      refundId: result.operationId,
      bookingId: booking.id,
      bookingCode: booking.code,
      ticketIds,
      seatCodes: tickets
        .filter((t) => ticketIds.includes(t.id))
        .map((t) => t.seatCode),
      amountVnd: preview.refundAmount,
      referenceCode: booking.code,
      status: "accepted",
      createdAt: result.acceptedAt,
    };
  },
};
