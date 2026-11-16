import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import {
  backendTicketSchema,
  bookingSchema,
  backendSeatSchema,
  pageOf,
} from "@/shared/api/contracts";
import { ApiError } from "@/shared/api/error";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import {
  getBackendTrip,
  toTrip,
} from "@/features/trips/repositories/backendTripRepository";
import type { TicketDetail } from "../types/ticketAccess";
import type { TicketRepository } from "./ticketRepository";
import { lookupAccessSchema, lookupFormSchema } from "../schemas/ticket.schema";
import { TICKET_ACCESS_HEADER, TICKET_ACCESS_TTL_MS } from "../config/access";

export type BackendTicket = z.infer<typeof backendTicketSchema>;
export async function ownedTickets(
  signal?: AbortSignal,
): Promise<BackendTicket[]> {
  const items: BackendTicket[] = [];
  for (let page = 0; ; page++) {
    const result = await apiJson(
      `/api/v1/tickets?page=${page}&size=100`,
      pageOf(backendTicketSchema),
      { signal },
    );
    items.push(...result.items);
    if (page + 1 >= result.totalPages) return items;
  }
}
export async function ownedBooking(
  code: string,
  signal?: AbortSignal,
): Promise<z.infer<typeof bookingSchema>> {
  if (z.string().uuid().safeParse(code).success)
    return apiJson(`/api/v1/bookings/${code}`, bookingSchema, { signal });
  for (let page = 0; ; page++) {
    const result = await apiJson(
      `/api/v1/bookings?page=${page}&size=100`,
      pageOf(bookingSchema),
      { signal },
    );
    const match = result.items.find(
      (v) => v.code.toUpperCase() === code.toUpperCase(),
    );
    if (match) return match;
    if (page + 1 >= result.totalPages)
      throw new BookingRepositoryError("NOT_FOUND", 404);
  }
}
export async function hydrateBackendTicket(
  ticket: BackendTicket,
  signal?: AbortSignal,
): Promise<TicketDetail> {
  const [booking, backendTrip] = await Promise.all([
    apiJson(`/api/v1/bookings/${ticket.bookingId}`, bookingSchema, { signal }),
    getBackendTrip(ticket.tripId, signal),
  ]);
  // Match by seat, since two passengers can have the same name.
  let item = booking.items.length === 1 ? booking.items[0] : undefined;
  if (!item) {
    const seats = await apiJson(
      `/api/v1/trips/${ticket.tripId}/seats`,
      z.object({ seats: z.array(backendSeatSchema) }),
      { signal },
    );
    const seat = seats.seats.find((v) => v.code === ticket.seatCode);
    item = booking.items.find((v) => v.seatId === seat?.id);
  }
  if (!item) throw new BookingRepositoryError("INVALID_RESPONSE", 200);
  return ticketDetail(ticket, booking.code, item, backendTrip);
}

function ticketDetail(
  ticket: BackendTicket,
  bookingCode: string,
  item: { seatId: string; pickupStopId: string; dropoffStopId: string },
  backendTrip: Awaited<ReturnType<typeof getBackendTrip>>,
): TicketDetail {
  const trip = toTrip(backendTrip);
  return {
    ticketId: ticket.id,
    ticketCode: ticket.publicCode,
    bookingId: ticket.bookingId,
    bookingCode,
    tripId: ticket.tripId,
    seatId: item.seatId,
    seatCode: ticket.seatCode,
    fareVnd: ticket.unitPrice ?? backendTrip.fare.amount,
    status: ticket.status === "CANCELLED" ? "cancelled" : "issued",
    transactionId: "",
    issuedAt: ticket.issuedAt,
    passenger: { fullName: ticket.passengerName },
    qrPayload:
      ticket.status === "ISSUED" ? (ticket.qrPayload ?? undefined) : undefined,
    trip: {
      ...trip,
      fareVnd: ticket.unitPrice ?? backendTrip.fare.amount,
      amenities: [...trip.amenities],
      stops: trip.stops ? [...trip.stops] : undefined,
      originStopName:
        backendTrip.stops.find((v) => v.id === item.pickupStopId)?.name ??
        trip.originStopName,
      destinationStopName:
        backendTrip.stops.find((v) => v.id === item.dropoffStopId)?.name ??
        trip.destinationStopName,
    },
  };
}
export async function getBackendTicketDetail(
  code: string,
  signal?: AbortSignal,
): Promise<TicketDetail> {
  const ticket = z.string().uuid().safeParse(code).success
    ? await apiJson(`/api/v1/tickets/${code}`, backendTicketSchema, { signal })
    : (await ownedTickets(signal)).find((v) => v.publicCode === code);
  if (!ticket) throw new BookingRepositoryError("NOT_FOUND", 404);
  return hydrateBackendTicket(
    await apiJson(`/api/v1/tickets/${ticket.id}`, backendTicketSchema, {
      signal,
    }),
    signal,
  );
}
export const backendTicketRepository: TicketRepository = {
  getHistory: async (_token, status, signal) => {
    const tickets = (await ownedTickets(signal)).filter(
      (t) =>
        status === "all" ||
        (status === "cancelled"
          ? t.status === "CANCELLED"
          : t.status !== "CANCELLED"),
    );
    const items = await Promise.all(
      tickets.map((v) => hydrateBackendTicket(v, signal)),
    );
    return { items, total: items.length };
  },
  getAccountDetail: (code, _token, signal) =>
    getBackendTicketDetail(code, signal),
  getDetail: async (code, token, signal) => {
    const data = await apiJson(
      `/api/v1/tickets/lookup/${encodeURIComponent(code)}`,
      z.object({
        ticket: backendTicketSchema,
        bookingCode: z.string(),
        seatId: z.uuid(),
        pickupStopId: z.uuid(),
        dropoffStopId: z.uuid(),
      }),
      { auth: false, signal, headers: { [TICKET_ACCESS_HEADER]: token } },
    );
    const trip = await getBackendTrip(data.ticket.tripId, signal);
    return ticketDetail(data.ticket, data.bookingCode, data, trip);
  },
  lookup: async (input, signal) => {
    const parsed = lookupFormSchema.safeParse(input);
    if (!parsed.success)
      throw new BookingRepositoryError("VALIDATION_ERROR", 400);
    try {
      const access = await apiJson(
        "/api/v1/tickets/lookup",
        lookupAccessSchema.unwrap().extend({
          expiresAt: z.iso
            .datetime({ offset: true })
            .transform((value) => new Date(value).toISOString()),
        }),
        { method: "POST", body: parsed.data, signal, auth: false },
      );
      const remaining = Date.parse(access.expiresAt) - Date.now();
      if (remaining <= 0 || remaining > TICKET_ACCESS_TTL_MS)
        throw new BookingRepositoryError("INVALID_RESPONSE", 200);
      return access;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404)
        throw new BookingRepositoryError("NOT_FOUND", 404);
      throw error;
    }
  },
};
