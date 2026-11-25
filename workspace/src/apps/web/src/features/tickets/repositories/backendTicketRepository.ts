import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import {
  backendTicketSchema,
  bookingSchema,
  backendSeatSchema,
  pageOf,
  type BackendTrip,
} from "@/shared/api/contracts";
import { ApiError } from "@/shared/api/error";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import {
  getBackendTrip,
  getBackendTrips,
  toTrip,
} from "@/features/trips/repositories/backendTripRepository";
import type { TicketDetail } from "../types/ticketAccess";
import type { TicketRepository } from "./ticketRepository";
import { lookupAccessSchema, lookupFormSchema } from "../schemas/ticket.schema";
import { TICKET_ACCESS_HEADER, TICKET_ACCESS_TTL_MS } from "../config/access";

export type BackendTicket = z.infer<typeof backendTicketSchema>;
export function lookupOwnedTickets(
  code: string,
  signal?: AbortSignal,
): Promise<BackendTicket[]> {
  return apiJson("/api/v1/tickets/my-lookup", z.array(backendTicketSchema), {
    method: "POST",
    body: { code },
    signal,
  });
}
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
export function ownedBooking(
  code: string,
  signal?: AbortSignal,
): Promise<z.infer<typeof bookingSchema>> {
  const prefix = z.guid().safeParse(code).success ? "" : "by-code/";
  return apiJson(
    `/api/v1/bookings/${prefix}${encodeURIComponent(code)}`,
    bookingSchema,
    { signal },
  );
}
export async function hydrateBackendTicket(
  ticket: BackendTicket,
  signal?: AbortSignal,
): Promise<TicketDetail> {
  return hydrateTicket(ticket, createTicketResources(signal));
}

function cacheById<T>(
  load: (id: string) => Promise<T>,
): (id: string) => Promise<T> {
  const requests = new Map<string, Promise<T>>();
  return (id) => {
    const existing = requests.get(id);
    if (existing) return existing;
    const pending = load(id);
    requests.set(id, pending);
    return pending;
  };
}

type TicketResources = {
  booking: (id: string) => Promise<z.infer<typeof bookingSchema>>;
  trip: (id: string) => Promise<BackendTrip>;
  seats: (id: string) => Promise<{ seats: z.infer<typeof backendSeatSchema>[] }>;
};

function createTicketResources(signal?: AbortSignal): TicketResources {
  return {
    booking: cacheById((id) =>
      apiJson(`/api/v1/bookings/${id}`, bookingSchema, { signal }),
    ),
    trip: cacheById((id) => getBackendTrip(id, signal)),
    seats: cacheById((id) =>
      apiJson(
        `/api/v1/trips/${id}/seats`,
        z.object({ seats: z.array(backendSeatSchema) }),
        { signal },
      ),
    ),
  };
}

async function hydrateTicket(
  ticket: BackendTicket,
  resources: TicketResources,
): Promise<TicketDetail> {
  const [booking, backendTrip] = await Promise.all([
    resources.booking(ticket.bookingId),
    resources.trip(ticket.tripId),
  ]);
  // Match by seat, since two passengers can have the same name.
  let item = booking.items.length === 1 ? booking.items[0] : undefined;
  const seatIndex = booking.seatCodes?.indexOf(ticket.seatCode) ?? -1;
  if (!item && seatIndex >= 0) item = booking.items[seatIndex];
  if (!item) {
    const seats = await resources.seats(ticket.tripId);
    const seat = seats.seats.find((v) => v.code === ticket.seatCode);
    item = booking.items.find((v) => v.seatId === seat?.id);
  }
  if (!item) throw new BookingRepositoryError("INVALID_RESPONSE", 200);
  return {
    ...ticketDetail(ticket, booking.code, item, backendTrip),
    bookingStatus: booking.status,
  };
}

export function ticketDetail(
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
    bookingStatus: ticket.journey?.bookingStatus,
    refundRequestId: ticket.refundRequestId,
    tripId: ticket.tripId,
    seatId: item.seatId,
    seatCode: ticket.seatCode,
    fareVnd: ticket.unitPrice ?? backendTrip.fare.amount,
    status: ticket.status === "CANCELLED" ? "cancelled" : "issued",
    paymentChannel:
      ticket.paymentChannel === "PREPAID" ? "PREPAID" : "PAY_LATER",
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
  const identifier = code.trim().toUpperCase();
  const id = z.guid().safeParse(code).success
    ? code
    : (await lookupOwnedTickets(identifier, signal)).find(
        (ticket) => ticket.publicCode === identifier,
      )?.id;
  if (!id) throw new BookingRepositoryError("NOT_FOUND", 404);
  return hydrateBackendTicket(
    await apiJson(`/api/v1/tickets/${id}`, backendTicketSchema, {
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
    const resources = createTicketResources(signal);
    const trips = await getBackendTrips(
      tickets.filter((ticket) => ticket.journey).map((ticket) => ticket.tripId),
      signal,
    );
    const items = await Promise.all(
      tickets.map((ticket) => {
        const trip = trips.get(ticket.tripId);
        return trip && ticket.journey
          ? ticketDetail(
              ticket,
              ticket.journey.bookingCode,
              ticket.journey,
              trip,
            )
          : hydrateTicket(ticket, resources);
      }),
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
        seatId: z.guid(),
        pickupStopId: z.guid(),
        dropoffStopId: z.guid(),
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
