import type { BookingSession } from "@/features/booking/types/booking";
import type { Seat } from "@/features/booking/types/seat";
import { bookingProblem } from "@/mocks/handlers/bookingHttp";
import type { MockDb } from "@/mocks/state/mockDb";

function updateAvailability(db: MockDb, tripId: string): void {
  const trip = db.trips.find((trip) => trip.id === tripId);
  if (trip)
    trip.availableSeatCount = (db.seats.get(tripId) ?? []).filter(
      (seat) => seat.status === "available",
    ).length;
}

function expireSession(db: MockDb, session: BookingSession): void {
  session.status = "expired";
  for (const seat of db.seats.get(session.tripId) ?? []) {
    if (db.holds.get(seat.id) !== session.sessionId) continue;
    if (seat.status === "held") seat.status = "available";
    db.holds.delete(seat.id);
  }
  updateAvailability(db, session.tripId);
}

export function releaseExpiredSessions(db: MockDb, nowMs: number): void {
  for (const session of db.sessions.values())
    if (session.status === "active" && !(Date.parse(session.expiresAt) > nowMs))
      expireSession(db, session);
}

export function requireActiveSession(
  db: MockDb,
  sessionId: string,
  nowMs: number,
  instance: string,
): BookingSession | Response {
  const session = db.sessions.get(sessionId);
  if (!session) return bookingProblem("NOT_FOUND", instance);
  if (session.status === "active" && !(Date.parse(session.expiresAt) > nowMs))
    expireSession(db, session);
  return session.status === "active"
    ? session
    : bookingProblem("HOLD_EXPIRED", instance);
}

function seatIsAvailable(
  db: MockDb,
  seat: Seat,
  sessionId: string,
  nowMs: number,
): boolean {
  if (seat.status === "available") return true;
  if (seat.status !== "held") return false;
  const owner = db.holds.get(seat.id);
  if (owner === sessionId) return true;
  const previous = owner ? db.sessions.get(owner) : undefined;
  return Boolean(
    previous?.status === "active" && !(Date.parse(previous.expiresAt) > nowMs),
  );
}

export function validateSessionSeats(
  db: MockDb,
  session: BookingSession,
  ids: string[],
  nowMs: number,
  instance: string,
): Response | null {
  if (new Set(ids).size !== ids.length)
    return bookingProblem("VALIDATION_ERROR", instance, {
      errors: { seatIds: ["Mỗi ghế chỉ được chọn một lần."] },
    });
  if (ids.length > 6)
    return bookingProblem("SELECTION_LIMIT_EXCEEDED", instance);
  const seats = db.seats.get(session.tripId) ?? [];
  const unknown = ids.some((id) => !seats.some((seat) => seat.id === id));
  const conflicts = seats
    .filter(
      (seat) =>
        ids.includes(seat.id) &&
        !seatIsAvailable(db, seat, session.sessionId, nowMs),
    )
    .map((seat) => seat.id);
  return unknown || conflicts.length
    ? bookingProblem("SEAT_CONFLICT", instance, {
        conflictingSeatIds: conflicts,
      })
    : null;
}

// Validation completes before this synchronous commit; no await can split it.
export function reserveSessionSeats(
  db: MockDb,
  session: BookingSession,
  ids: string[],
  nowMs: number,
  fareVnd: number,
): void {
  releaseExpiredSessions(db, nowMs);
  for (const seat of db.seats.get(session.tripId) ?? []) {
    if (db.holds.get(seat.id) === session.sessionId && !ids.includes(seat.id)) {
      seat.status = "available";
      db.holds.delete(seat.id);
    }
    if (ids.includes(seat.id)) {
      seat.status = "held";
      db.holds.set(seat.id, session.sessionId);
    }
  }
  session.selectedSeatIds = [...ids];
  session.totalVnd = fareVnd * ids.length;
  session.passengers = session.passengers.filter((passenger) =>
    ids.includes(passenger.seatId),
  );
  updateAvailability(db, session.tripId);
}
