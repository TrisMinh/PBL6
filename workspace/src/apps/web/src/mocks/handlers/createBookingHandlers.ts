import { http, HttpResponse } from "msw";
import { z } from "zod";

import { isCompleteBookingSession } from "@/mocks/state/bookingCheckout";
import { bookingAttemptKeySchema } from "@/features/booking/schemas/bookingCreation.schema";
import type { BookingSession } from "@/features/booking/types/booking";
import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";
import {
  bookingProblem,
  bookingIdSchema,
  readBookingBody,
} from "@/mocks/handlers/bookingHttp";
import { requireActiveSession } from "@/mocks/state/bookingSeats";
import { mockDb, type MockDb } from "@/mocks/state/mockDb";

export interface CreateOrderOptions {
  db?: MockDb;
  now?: () => number;
  createBookingId?: () => string;
}
const PATH = "/api/v1/bookings";
const bodySchema = z.object({ sessionId: bookingIdSchema }).strict();
type OrderContext = Required<CreateOrderOptions>;
function commitBooking(
  context: OrderContext,
  session: BookingSession,
  key: string,
): Response {
  const { db } = context;
  const previousId = db.bookingKeys.get(key);
  const previous = previousId ? db.bookings.get(previousId) : undefined;
  if (previous && previous.sessionId !== session.sessionId)
    return bookingProblem("IDEMPOTENCY_CONFLICT", PATH);
  if (!isCompleteBookingSession(db, session))
    return bookingProblem("VALIDATION_ERROR", PATH);
  const existing = session.bookingId
    ? db.bookings.get(session.bookingId)
    : undefined;
  if (session.bookingId && !existing)
    return bookingProblem("IDEMPOTENCY_CONFLICT", PATH);
  const booking = existing ?? newBooking(context, session);
  db.bookings.set(booking.bookingId, booking);
  db.bookingKeys.set(key, booking.bookingId);
  session.bookingId = booking.bookingId;
  session.bookingAttemptKey ??= key;
  return HttpResponse.json(booking, { status: 201 });
}
function newBooking(
  context: OrderContext,
  session: BookingSession,
): BookingCreationSummary {
  const bookingId = context.createBookingId();
  return Object.freeze({
    bookingId,
    bookingCode: `BLUE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    sessionId: session.sessionId,
    totalVnd: session.totalVnd,
    status: "pending-payment",
  });
}
async function postBooking(
  context: OrderContext,
  request: Request,
): Promise<Response> {
  const body = await readBookingBody(request, bodySchema, PATH, "sessionId");
  if ("error" in body) return body.error;
  const key = bookingAttemptKeySchema.safeParse(
    request.headers.get("Idempotency-Key"),
  );
  if (!key.success) return bookingProblem("VALIDATION_ERROR", PATH);
  const session = requireActiveSession(
    context.db,
    body.data.sessionId,
    context.now(),
    PATH,
  );
  if (session instanceof Response) return session;
  return commitBooking(context, session, key.data);
}
export function createOrderHandlers(
  options: CreateOrderOptions = {},
): ReturnType<typeof http.post>[] {
  const context: OrderContext = {
    db: options.db ?? mockDb,
    now: options.now ?? Date.now,
    createBookingId: options.createBookingId ?? (() => crypto.randomUUID()),
  };
  return [
    http.post(PATH, async ({ request }) => {
      context.db.hydrate(context.now());
      const response = await postBooking(context, request);
      if (response.ok || response.status === 410)
        context.db.save(context.now());
      return response;
    }),
  ];
}
export const orderHandlers = createOrderHandlers();
