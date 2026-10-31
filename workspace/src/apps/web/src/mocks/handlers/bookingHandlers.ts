import { http, HttpResponse } from "msw";

import type { BookingSession } from "@/features/booking/types/booking";
import {
  bookingProblem,
  createSessionSchema,
  readBookingBody,
  replaceSeatsSchema,
  replacePassengersSchema,
} from "@/mocks/handlers/bookingHttp";
import {
  releaseExpiredSessions,
  requireActiveSession,
  reserveSessionSeats,
  validateSessionSeats,
} from "@/mocks/state/bookingSeats";
import { mockDb, type MockDb } from "@/mocks/state/mockDb";

export interface BookingHandlerOptions {
  db?: MockDb;
  now?: () => number;
  createSessionId?: () => string;
}

type BookingContext = Required<BookingHandlerOptions>;
async function handleBooking(
  context: BookingContext,
  execute: () => Response | Promise<Response>,
): Promise<Response> {
  context.db.hydrate(context.now());
  const response = await execute();
  if (response.ok || response.status === 410) context.db.save(context.now());
  return response;
}
const SESSION_PATH = "/api/v1/booking-sessions";
const SEATS_PATH = "/api/v1/trips/:tripId/seats";
const SELECTION_PATH = "/api/v1/booking-sessions/:sessionId/seats";
const PASSENGERS_PATH = "/api/v1/booking-sessions/:sessionId/passengers";

function getSeats({ db, now }: BookingContext, tripId: string): Response {
  const trip = db.trips.find((trip) => trip.id === tripId);
  const items = db.seats.get(tripId);
  if (!trip || !items) return bookingProblem("NOT_FOUND", SEATS_PATH);
  releaseExpiredSessions(db, now());
  return HttpResponse.json({
    tripId,
    vehicleType: trip.vehicleType,
    trip,
    items,
  });
}

function startSession(
  context: BookingContext,
  tripId: string,
  passengerCount: number,
  key: string | null,
): Response {
  const { db, now, createSessionId } = context;
  const nowMs = now();
  if (!db.trips.some((trip) => trip.id === tripId))
    return bookingProblem("NOT_FOUND", SESSION_PATH);
  const previousId = key ? db.sessionKeys.get(key) : undefined;
  const previous = previousId ? db.sessions.get(previousId) : undefined;
  if (
    previous &&
    (previous.tripId !== tripId || previous.passengerCount !== passengerCount)
  )
    return bookingProblem("VALIDATION_ERROR", SESSION_PATH, {
      errors: { idempotencyKey: ["Dùng khóa khác cho chuyến mới."] },
    });
  if (previous) {
    const active = requireActiveSession(
      db,
      previous.sessionId,
      nowMs,
      SESSION_PATH,
    );
    return active instanceof Response
      ? active
      : HttpResponse.json(active, { status: 201 });
  }
  releaseExpiredSessions(db, nowMs);
  const session = newSession(tripId, passengerCount, nowMs, createSessionId);
  db.sessions.set(session.sessionId, session);
  if (key) db.sessionKeys.set(key, session.sessionId);
  return HttpResponse.json(session, { status: 201 });
}

function newSession(
  tripId: string,
  passengerCount: number,
  nowMs: number,
  createId: () => string,
): BookingSession {
  return {
    sessionId: createId(),
    tripId,
    passengerCount,
    selectedSeatIds: [],
    passengers: [],
    expiresAt: new Date(nowMs + 600_000).toISOString(),
    totalVnd: 0,
    status: "active",
  };
}

async function putSeats(
  { db, now }: BookingContext,
  request: Request,
  sessionId: string,
): Promise<Response> {
  const body = await readBookingBody(
    request,
    replaceSeatsSchema,
    SELECTION_PATH,
    "seatIds",
  );
  if ("error" in body) return body.error;
  const nowMs = now();
  const session = requireActiveSession(db, sessionId, nowMs, SELECTION_PATH);
  if (session instanceof Response) return session;
  if (session.bookingId)
    return bookingProblem("BOOKING_LOCKED", SELECTION_PATH);
  const trip = db.trips.find((trip) => trip.id === session.tripId);
  if (!trip || !db.seats.has(session.tripId))
    return bookingProblem("NOT_FOUND", SELECTION_PATH);
  const invalid = validateSessionSeats(
    db,
    session,
    body.data.seatIds,
    nowMs,
    SELECTION_PATH,
  );
  if (invalid) return invalid;
  reserveSessionSeats(db, session, body.data.seatIds, nowMs, trip.fareVnd);
  return HttpResponse.json(session);
}

async function putPassengers(
  { db, now }: BookingContext,
  request: Request,
  sessionId: string,
): Promise<Response> {
  const body = await readBookingBody(
    request,
    replacePassengersSchema,
    PASSENGERS_PATH,
    "passengers",
  );
  if ("error" in body) return body.error;
  const session = requireActiveSession(db, sessionId, now(), PASSENGERS_PATH);
  if (session instanceof Response) return session;
  if (session.bookingId)
    return bookingProblem("BOOKING_LOCKED", PASSENGERS_PATH);
  const ids = body.data.passengers.map((passenger) => passenger.seatId);
  if (
    ids.length !== session.selectedSeatIds.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !session.selectedSeatIds.includes(id))
  )
    return bookingProblem("VALIDATION_ERROR", PASSENGERS_PATH, {
      errors: { passengers: ["Mỗi ghế đã chọn cần đúng một hành khách."] },
    });
  session.contact = body.data.contact;
  session.passengers = body.data.passengers;
  return HttpResponse.json(session);
}

async function postSession(
  context: BookingContext,
  request: Request,
): Promise<Response> {
  const body = await readBookingBody(
    request,
    createSessionSchema,
    SESSION_PATH,
    "tripId",
  );
  if ("error" in body) return body.error;
  const key = request.headers.get("Idempotency-Key");
  if (key !== null && !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
    return bookingProblem("VALIDATION_ERROR", SESSION_PATH, {
      errors: { idempotencyKey: ["Dùng khóa đặt vé hợp lệ."] },
    });
  return startSession(context, body.data.tripId, body.data.passengerCount, key);
}

export function createBookingHandlers(
  options: BookingHandlerOptions = {},
): ReturnType<typeof http.get>[] {
  const context: BookingContext = {
    db: options.db ?? mockDb,
    now: options.now ?? Date.now,
    createSessionId: options.createSessionId ?? (() => crypto.randomUUID()),
  };
  return [
    http.get(SEATS_PATH, ({ params }) =>
      handleBooking(context, () =>
        getSeats(
          context,
          typeof params.tripId === "string" ? params.tripId : "",
        ),
      ),
    ),
    http.post(SESSION_PATH, ({ request }) =>
      handleBooking(context, () => postSession(context, request)),
    ),
    ...sessionHandlers(context),
  ];
}

function sessionHandlers(
  context: BookingContext,
): ReturnType<typeof http.put>[] {
  return [
    http.put(SELECTION_PATH, ({ request, params }) =>
      handleBooking(context, () =>
        putSeats(
          context,
          request,
          typeof params.sessionId === "string" ? params.sessionId : "",
        ),
      ),
    ),
    http.put(PASSENGERS_PATH, ({ request, params }) =>
      handleBooking(context, () =>
        putPassengers(
          context,
          request,
          typeof params.sessionId === "string" ? params.sessionId : "",
        ),
      ),
    ),
  ];
}

export const bookingHandlers = createBookingHandlers();
