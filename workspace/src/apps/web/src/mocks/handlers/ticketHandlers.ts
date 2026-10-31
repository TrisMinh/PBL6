import { http, HttpResponse } from "msw";

import {
  TICKET_ACCESS_HEADER,
  TICKET_ACCESS_TTL_MS,
} from "@/features/tickets/config/access";
import {
  lookupRequestSchema,
  lookupTokenSchema,
  normalizeVerification,
  ticketDetailSchema,
} from "@/features/tickets/schemas/ticket.schema";
import { ticketProblem } from "@/mocks/handlers/ticketHttp";
import { mockDb, type MockDb } from "@/mocks/state/mockDb";
import { MOCK_SESSION_HEADER } from "@/features/auth/config/session";
import { accountOwnsTicket, readAuthGrant } from "@/mocks/state/authState";
import { MAX_TICKET_ACCESS_SESSIONS } from "@/mocks/state/ticketAccessState";

interface Context {
  db: MockDb;
  now: () => number;
}
const LOOKUP_PATH = "/api/v1/tickets/lookup";
const DETAIL_PATH = "/api/v1/tickets/:ticketCode";
function sameProof(a: string | null, b: string | null): boolean {
  let difference = (a?.length ?? 0) ^ (b?.length ?? 0);
  for (let i = 0; i < 254; i++)
    difference |= (a?.charCodeAt(i) || 0) ^ (b?.charCodeAt(i) || 0);
  return a !== null && b !== null && difference === 0;
}
async function lookup(context: Context, request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ticketProblem("VALIDATION_ERROR", LOOKUP_PATH);
  }
  const parsed = lookupRequestSchema.safeParse(body);
  if (!parsed.success) return ticketProblem("VALIDATION_ERROR", LOOKUP_PATH);
  const proof = normalizeVerification(parsed.data.verificationValue);
  const tickets = [...context.db.tickets.values()].filter(
    (t) => t.bookingCode === parsed.data.bookingCode.toUpperCase(),
  );
  const owner = tickets[0]?.guestVerification;
  const emailMatches = sameProof(
    proof,
    owner ? normalizeVerification(owner.email) : null,
  );
  const phoneMatches = sameProof(
    proof,
    owner ? normalizeVerification(owner.phone) : null,
  );
  if (!tickets.length || !(emailMatches || phoneMatches))
    return ticketProblem("NOT_FOUND", LOOKUP_PATH);
  return grantAccess(
    context,
    tickets.map((t) => t.ticketCode),
  );
}
function grantAccess(context: Context, ticketCodes: string[]): Response {
  const now = context.now();
  for (const [token, grant] of context.db.ticketAccess)
    if (Date.parse(grant.expiresAt) <= now)
      context.db.ticketAccess.delete(token);
  if (context.db.ticketAccess.size >= MAX_TICKET_ACCESS_SESSIONS)
    return ticketProblem("SERVICE_UNAVAILABLE", LOOKUP_PATH);
  const token = crypto.randomUUID(),
    expiresAt = new Date(now + TICKET_ACCESS_TTL_MS).toISOString();
  const access = Object.freeze({
    token,
    ticketCodes: Object.freeze(ticketCodes),
    expiresAt,
  });
  context.db.ticketAccess.set(
    token,
    Object.freeze({ ...access, createdAt: new Date(now).toISOString() }),
  );
  return HttpResponse.json(access, {
    headers: { "Cache-Control": "no-store" },
  });
}
function detail(
  context: Context,
  request: Request,
  ticketCode: string,
): Response {
  if (request.headers.has(MOCK_SESSION_HEADER))
    return accountDetail(context, request, ticketCode);
  const token = lookupTokenSchema.safeParse(
    request.headers.get(TICKET_ACCESS_HEADER),
  );
  const grant = token.success
    ? context.db.ticketAccess.get(token.data)
    : undefined;
  if (!grant) return ticketProblem("ACCESS_REQUIRED", DETAIL_PATH);
  if (Date.parse(grant.expiresAt) <= context.now()) {
    context.db.ticketAccess.delete(grant.token);
    return ticketProblem("LOOKUP_EXPIRED", DETAIL_PATH);
  }
  const ticket = [...context.db.tickets.values()].find(
    (t) => t.ticketCode === ticketCode,
  );
  if (!ticket || !grant.ticketCodes.includes(ticketCode))
    return ticketProblem("NOT_FOUND", DETAIL_PATH);
  const trip = context.db.trips.find((t) => t.id === ticket.tripId);
  const parsed = ticketDetailSchema.safeParse({
    ...ticket,
    trip,
    passenger: { fullName: ticket.passenger.fullName },
  });
  return parsed.success
    ? HttpResponse.json(parsed.data, {
        headers: { "Cache-Control": "no-store" },
      })
    : ticketProblem("NOT_FOUND", DETAIL_PATH);
}

function accountDetail(
  context: Context,
  request: Request,
  ticketCode: string,
): Response {
  const grant = readAuthGrant(context.db, request, context.now());
  if (!grant) return ticketProblem("ACCESS_REQUIRED", DETAIL_PATH);
  const ticket = [...context.db.tickets.values()].find(
    (item) => item.ticketCode === ticketCode,
  );
  if (!ticket || !accountOwnsTicket(grant, ticket.guestVerification.email))
    return ticketProblem("NOT_FOUND", DETAIL_PATH);
  const parsed = ticketDetailSchema.safeParse({
    ...ticket,
    trip: context.db.trips.find((trip) => trip.id === ticket.tripId),
    passenger: { fullName: ticket.passenger.fullName },
  });
  return parsed.success
    ? HttpResponse.json(parsed.data, {
        headers: { "Cache-Control": "no-store" },
      })
    : ticketProblem("NOT_FOUND", DETAIL_PATH);
}

export function createTicketHandlers(
  options: { db?: MockDb; now?: () => number } = {},
): ReturnType<typeof http.get>[] {
  const context = { db: options.db ?? mockDb, now: options.now ?? Date.now };
  return [
    http.post(LOOKUP_PATH, async ({ request }) => {
      context.db.hydrate(context.now());
      const response = await lookup(context, request);
      if (response.ok) context.db.save(context.now());
      return response;
    }),
    http.get(DETAIL_PATH, ({ request, params }) => {
      context.db.hydrate(context.now());
      const response = detail(context, request, String(params.ticketCode));
      if (response.status === 410) context.db.save(context.now());
      return response;
    }),
  ];
}
export const ticketHandlers = createTicketHandlers();
