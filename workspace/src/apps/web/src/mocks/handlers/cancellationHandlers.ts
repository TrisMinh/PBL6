import { http, HttpResponse, type HttpHandler } from "msw";

import {
  cancellationKeySchema,
  cancellationOptionsSchema,
  cancellationRequestSchema,
  refundSchema,
} from "@/features/cancellation/schemas/cancellation.schema";
import { MOCK_SESSION_HEADER } from "@/features/auth/config/session";
import { TICKET_ACCESS_HEADER } from "@/features/tickets/config/access";
import {
  lookupTokenSchema,
  ticketCodeSchema,
  ticketDetailSchema,
} from "@/features/tickets/schemas/ticket.schema";
import type { Ticket } from "@/features/tickets/types/ticket";
import { accountOwnsTicket, readAuthGrant } from "@/mocks/state/authState";
import { MAX_CANCELLATIONS } from "@/mocks/state/cancellationState";
import { mockDb, type MockDb } from "@/mocks/state/mockDb";

interface Context {
  db: MockDb;
  now: () => number;
}
interface CancelInput {
  bookingCode: string;
  key: string;
  ids: readonly string[];
}
const PATH = "/api/v1/bookings/:bookingCode/cancellation";
const POST_PATH = "/api/v1/bookings/:bookingCode/cancellations";

function problem(code: string, status: number, instance: string): Response {
  return HttpResponse.json(
    { code, instance, traceId: crypto.randomUUID() },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function guestTickets(
  context: Context,
  request: Request,
): readonly Ticket[] | null {
  const parsed = lookupTokenSchema.safeParse(
    request.headers.get(TICKET_ACCESS_HEADER),
  );
  const grant = parsed.success
    ? context.db.ticketAccess.get(parsed.data)
    : undefined;
  if (!grant || Date.parse(grant.expiresAt) <= context.now()) return null;
  return [...context.db.tickets.values()].filter((ticket) =>
    grant.ticketCodes.includes(ticket.ticketCode),
  );
}

function authorizedTickets(
  context: Context,
  request: Request,
): readonly Ticket[] | null {
  if (!request.headers.has(MOCK_SESSION_HEADER))
    return guestTickets(context, request);
  const grant = readAuthGrant(context.db, request, context.now());
  if (!grant) return null;
  return [...context.db.tickets.values()].filter((ticket) =>
    accountOwnsTicket(grant, ticket.guestVerification.email),
  );
}

function project(context: Context, ticket: Ticket): unknown {
  return ticketDetailSchema.parse({
    ...ticket,
    passenger: { fullName: ticket.passenger.fullName },
    trip: context.db.trips.find((trip) => trip.id === ticket.tripId),
  });
}

function bookingTickets(
  tickets: readonly Ticket[],
  bookingCode: string,
): readonly Ticket[] {
  return tickets.filter((ticket) => ticket.bookingCode === bookingCode);
}

function options(
  context: Context,
  request: Request,
  rawBookingCode: string,
): Response {
  const code = ticketCodeSchema.safeParse(rawBookingCode.toUpperCase());
  if (!code.success) return problem("NOT_FOUND", 404, PATH);
  const authorized = authorizedTickets(context, request);
  if (!authorized) return problem("ACCESS_REQUIRED", 401, PATH);
  const all = bookingTickets(authorized, code.data);
  if (!all.length) return problem("NOT_FOUND", 404, PATH);
  const latestRefund =
    [...context.db.refunds.values()]
      .filter((refund) => refund.bookingCode === code.data)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  const cancellable = all.filter((ticket) => ticket.status === "issued");
  const parsed = cancellationOptionsSchema.safeParse({
    bookingId: all[0].bookingId,
    bookingCode: code.data,
    tickets: cancellable.map((ticket) => project(context, ticket)),
    ticketPresentations: cancellable.map((ticket, index) => ({
      ticketId: ticket.ticketId,
      maskedPhone: index === 0 ? "09•• ••• 218" : "09•• ••• 762",
    })),
    journey: {
      operatorName: "Công ty TNHH RedLine Express",
      tripCode: "RLX-0730",
      departureTime: "07:30",
      arrivalTime: "13:30",
      originCity: "TP. Hồ Chí Minh",
      originStop: "Miền Đông mới · Cổng 3",
      destinationCity: "Đà Lạt",
      destinationStop: "Trung tâm Đà Lạt",
      durationLabel: "6 giờ 30 · Đi thẳng",
      serviceDateLabel: "07:30 ngày 28/08/2026",
      pickupTitle: "Bến xe Miền Đông mới · Cổng 3 · Khu xe RedLine · Cột B12",
      pickupAddress: "501 Hoàng Hữu Nam, P. Long Bình, TP. Thủ Đức, TP.HCM",
      checkInLabel: "Có mặt 07:10",
      requestedAtLabel: "10:34:12",
      recordedAtLabel: "10:34:11",
    },
    latestRefund,
    refundRatePercent: 90,
    feeRatePercent: 10,
    policyLabel: "Mức 1 — Hủy trước 48 giờ",
  });
  return parsed.success
    ? HttpResponse.json(parsed.data, {
        headers: { "Cache-Control": "no-store" },
      })
    : problem("NOT_FOUND", 404, PATH);
}

function replay(
  context: Context,
  key: string,
  bookingCode: string,
  ticketIds: readonly string[],
): Response | null {
  const existing = context.db.cancellationKeys.get(key);
  if (!existing) return null;
  const same =
    existing.bookingCode === bookingCode &&
    JSON.stringify(existing.ticketIds) === JSON.stringify(ticketIds);
  const refund = context.db.refunds.get(existing.refundId);
  if (!same || !refund) return problem("IDEMPOTENCY_CONFLICT", 409, POST_PATH);
  return HttpResponse.json(refund, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}

function commitCancellation(
  context: Context,
  key: string,
  bookingCode: string,
  selected: readonly Ticket[],
): Response {
  const ticketIds = selected.map((ticket) => ticket.ticketId).sort();
  const refund = refundSchema.parse({
    refundId: crypto.randomUUID(),
    bookingId: selected[0].bookingId,
    bookingCode,
    ticketIds,
    seatCodes: [...selected]
      .sort((left, right) => left.seatCode.localeCompare(right.seatCode))
      .map((ticket) => ticket.seatCode),
    amountVnd: Math.round(
      selected.reduce((total, ticket) => total + ticket.fareVnd, 0) * 0.9,
    ),
    referenceCode: "RF-20260826-0192",
    status: "processing",
    createdAt: new Date(context.now()).toISOString(),
  });
  for (const ticket of selected)
    context.db.tickets.set(
      ticket.ticketId,
      Object.freeze({ ...ticket, status: "cancelled" }),
    );
  context.db.refunds.set(refund.refundId, refund);
  context.db.cancellationKeys.set(
    key,
    Object.freeze({ key, bookingCode, ticketIds, refundId: refund.refundId }),
  );
  context.db.save(context.now());
  return HttpResponse.json(refund, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}

async function cancel(
  context: Context,
  request: Request,
  rawBookingCode: string,
): Promise<Response> {
  const parsed = await readCancellationInput(request, rawBookingCode);
  if (parsed instanceof Response) return parsed;
  const authorized = authorizedTickets(context, request);
  if (!authorized) return problem("ACCESS_REQUIRED", 401, POST_PATH);
  const allowed = bookingTickets(authorized, parsed.bookingCode);
  if (!allowed.length) return problem("NOT_FOUND", 404, POST_PATH);
  const previous = replay(context, parsed.key, parsed.bookingCode, parsed.ids);
  if (previous) return previous;
  const selected = parsed.ids.map((id) =>
    allowed.find((ticket) => ticket.ticketId === id),
  );
  if (selected.some((ticket) => !ticket || ticket.status !== "issued"))
    return problem("CANCELLATION_NOT_ALLOWED", 409, POST_PATH);
  if (
    context.db.refunds.size >= MAX_CANCELLATIONS ||
    context.db.cancellationKeys.size >= MAX_CANCELLATIONS
  )
    return problem("SERVICE_UNAVAILABLE", 503, POST_PATH);
  return commitCancellation(
    context,
    parsed.key,
    parsed.bookingCode,
    selected.filter((ticket): ticket is Ticket => Boolean(ticket)),
  );
}

async function readCancellationInput(
  request: Request,
  rawBookingCode: string,
): Promise<CancelInput | Response> {
  const bookingCode = ticketCodeSchema.safeParse(rawBookingCode.toUpperCase());
  const key = cancellationKeySchema.safeParse(
    request.headers.get("Idempotency-Key"),
  );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem("VALIDATION_ERROR", 400, POST_PATH);
  }
  const input = cancellationRequestSchema.safeParse(body);
  if (!bookingCode.success || !key.success || !input.success)
    return problem("VALIDATION_ERROR", 400, POST_PATH);
  return {
    bookingCode: bookingCode.data,
    key: key.data,
    ids: [...input.data.ticketIds].sort(),
  };
}

export function createCancellationHandlers(
  optionsValue: { db?: MockDb; now?: () => number } = {},
): HttpHandler[] {
  const context = {
    db: optionsValue.db ?? mockDb,
    now: optionsValue.now ?? Date.now,
  };
  return [
    http.get(PATH, ({ request, params }) => {
      context.db.hydrate(context.now());
      return options(context, request, String(params.bookingCode));
    }),
    http.post(POST_PATH, async ({ request, params }) => {
      context.db.hydrate(context.now());
      return cancel(context, request, String(params.bookingCode));
    }),
  ];
}

export const cancellationHandlers = createCancellationHandlers();
