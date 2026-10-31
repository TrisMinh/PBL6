import { z } from "zod";

import {
  authSnapshotSchema,
  validAuthGrants,
} from "@/mocks/state/authSnapshot";
import {
  collectTicketAccess,
  ticketAccessSnapshotSchema,
  validTicketAccess,
} from "@/mocks/state/ticketAccessSnapshot";
import {
  PAYMENT_RECEIPT_TTL_MS,
  collectPaymentArchive,
  paymentArchiveShape,
  restorePaymentArchive,
  validPaymentArchive,
} from "@/mocks/state/paymentSnapshot";
import { bookingPassengerCountSchema } from "@/features/booking/schemas/passengerCount.schema";
import {
  bookingAttemptKeySchema,
  bookingCreationSchema,
} from "@/features/booking/schemas/bookingCreation.schema";
import { createPassengerSchema } from "@/features/booking/schemas/passenger.schema";
import type { BookingSession } from "@/features/booking/types/booking";
import { replacePassengersSchema } from "@/mocks/handlers/bookingHttp";
import type { MockDb } from "@/mocks/state/mockDb";
import {
  cancellationArchiveShape,
  collectCancellationArchive,
  restoreCancellationArchive,
  validCancellationArchive,
} from "@/mocks/state/cancellationSnapshot";

export const MOCK_BOOKING_STORAGE_KEY = "blue-mock-booking-db";
const MAX_SNAPSHOT_LENGTH = 262_144;
const sessionSchema = z
  .object({
    sessionId: z.string().min(1).max(128),
    bookingId: z.string().min(1).max(128).optional(),
    bookingAttemptKey: bookingAttemptKeySchema.optional(),
    tripId: z.string().min(1).max(128),
    passengerCount: bookingPassengerCountSchema,
    selectedSeatIds: z.array(z.string().min(1).max(128)).max(6),
    contact: replacePassengersSchema.shape.contact.optional(),
    passengers: replacePassengersSchema.shape.passengers.max(6),
    expiresAt: z.iso.datetime(),
    totalVnd: z.number().int().nonnegative(),
    status: z.literal("active"),
  })
  .strict();
const snapshotSchema = z
  .object({
    version: z.literal(1),
    authSessions: authSnapshotSchema,
    ticketAccess: ticketAccessSnapshotSchema,
    ...paymentArchiveShape,
    ...cancellationArchiveShape,
    bookings: z.array(bookingCreationSchema).max(100).default([]),
    bookingKeys: z
      .array(z.tuple([bookingAttemptKeySchema, z.string()]))
      .max(100)
      .default([]),
    sessions: z.array(sessionSchema).max(100),
    sessionKeys: z
      .array(
        z.tuple([z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/), z.string()]),
      )
      .max(100),
  })
  .strict();
type Snapshot = z.infer<typeof snapshotSchema>;
function pruneCancellationArchive(snapshot: Snapshot): void {
  snapshot.refunds = snapshot.refunds.filter((refund) =>
    refund.ticketIds.every((id) =>
      snapshot.tickets.some((ticket) => ticket.ticketId === id),
    ),
  );
  snapshot.cancellationKeys = snapshot.cancellationKeys.filter((record) =>
    snapshot.refunds.some((refund) => refund.refundId === record.refundId),
  );
}
function pruneExpired(snapshot: Snapshot, now: number): Snapshot {
  snapshot.authSessions = snapshot.authSessions.filter(
    (grant) => Date.parse(grant.expiresAt) > now,
  );
  const expiredSessions = new Set(
    snapshot.sessions
      .filter((s) => Date.parse(s.expiresAt) <= now)
      .map((s) => s.sessionId),
  );
  snapshot.sessions = snapshot.sessions.filter(
    (s) => !expiredSessions.has(s.sessionId),
  );
  snapshot.sessionKeys = snapshot.sessionKeys.filter(
    ([, id]) => !expiredSessions.has(id),
  );
  const archived = collectArchive(snapshot, now);
  snapshot.payments = archived.payments;
  snapshot.paymentKeys = archived.paymentKeys;
  snapshot.tickets = archived.tickets;
  pruneCancellationArchive(snapshot);
  snapshot.ticketAccess = snapshot.ticketAccess.filter(
    (g) => Date.parse(g.expiresAt) > now,
  );
  snapshot.bookings = snapshot.bookings.filter(
    (b) =>
      !expiredSessions.has(b.sessionId) ||
      snapshot.payments.some(
        (p) =>
          p.transaction.bookingId === b.bookingId &&
          p.result &&
          p.result.status !== "pending",
      ),
  );
  snapshot.bookingKeys = snapshot.bookingKeys.filter(([, id]) =>
    snapshot.bookings.some((b) => b.bookingId === id),
  );
  return snapshot;
}
function collectArchive(
  snapshot: Snapshot,
  now: number,
): Pick<Snapshot, "payments" | "paymentKeys" | "tickets"> {
  const expired = new Set(
    snapshot.payments
      .filter(
        (p) =>
          Date.parse(p.transaction.createdAt) + PAYMENT_RECEIPT_TTL_MS <= now ||
          ((!p.result || p.result.status === "pending") &&
            Date.parse(p.transaction.expiresAt) <= now),
      )
      .map((p) => p.transaction.transactionId),
  );
  return {
    payments: snapshot.payments.filter(
      (p) => !expired.has(p.transaction.transactionId),
    ),
    paymentKeys: snapshot.paymentKeys.filter(([, id]) => !expired.has(id)),
    tickets: snapshot.tickets.filter((t) => !expired.has(t.transactionId)),
  };
}

export interface MockStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

// Access stays lazy; denied/absent storage deliberately falls back to memory.
function browserStorage(): Storage | undefined {
  if (
    import.meta.env.PROD ||
    !(import.meta.env.DEV || import.meta.env.MODE === "test") ||
    typeof window === "undefined"
  )
    return undefined;
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export const browserMockStorage: MockStorage = {
  getItem: (key) => browserStorage()?.getItem(key) ?? null,
  setItem: (key, value) => {
    browserStorage()?.setItem(key, value);
  },
  removeItem: (key) => {
    browserStorage()?.removeItem(key);
  },
};

export function clearMockSnapshot(storage?: MockStorage): void {
  try {
    storage?.removeItem(MOCK_BOOKING_STORAGE_KEY);
  } catch {
    /* Storage denial preserves the in-memory mock; no payload is logged. */
  }
}

function validSession(
  db: MockDb,
  session: BookingSession,
  nowMs: number,
): boolean {
  const trip = db.trips.find((trip) => trip.id === session.tripId);
  const seats = db.seats.get(session.tripId) ?? [];
  const expiry = Date.parse(session.expiresAt);
  const selected = new Set(session.selectedSeatIds);
  const passengerIds = session.passengers.map((passenger) => passenger.seatId);
  return Boolean(
    trip &&
    expiry > nowMs &&
    expiry <= nowMs + 600_000 &&
    selected.size === session.selectedSeatIds.length &&
    session.totalVnd === trip.fareVnd * selected.size &&
    session.selectedSeatIds.every((id) =>
      seats.some((seat) => seat.id === id && seat.status === "available"),
    ) &&
    new Set(passengerIds).size === passengerIds.length &&
    passengerIds.every((id) => selected.has(id)),
  );
}

function validSnapshot(db: MockDb, snapshot: Snapshot, nowMs: number): boolean {
  const sessionIds = snapshot.sessions.map((session) => session.sessionId);
  const seatIds = snapshot.sessions.flatMap(
    (session) => session.selectedSeatIds,
  );
  const keys = snapshot.sessionKeys.map(([key]) => key);
  return (
    new Set(sessionIds).size === sessionIds.length &&
    validAuthGrants(snapshot.authSessions, nowMs) &&
    new Set(seatIds).size === seatIds.length &&
    new Set(keys).size === keys.length &&
    validBookings(snapshot) &&
    validTicketAccess(snapshot.ticketAccess, snapshot.tickets, nowMs) &&
    validPaymentArchive(
      db,
      snapshot,
      snapshot.bookings,
      snapshot.sessions,
      nowMs,
    ) &&
    validCancellationArchive(snapshot, snapshot.tickets) &&
    snapshot.sessionKeys.every(([, id]) => sessionIds.includes(id)) &&
    snapshot.sessions.every((session) => validSession(db, session, nowMs))
  );
}

function validBooking(
  snapshot: Snapshot,
  booking: Snapshot["bookings"][number],
): boolean {
  const session = snapshot.sessions.find(
    (item) => item.sessionId === booking.sessionId,
  );
  if (!session)
    return snapshot.payments.some(
      (p) =>
        p.transaction.bookingId === booking.bookingId &&
        p.result &&
        p.result.status !== "pending",
    );
  return Boolean(
    session.bookingId === booking.bookingId &&
    session.totalVnd === booking.totalVnd &&
    session.selectedSeatIds.length === session.passengerCount &&
    session.bookingAttemptKey &&
    snapshot.bookingKeys.some(
      ([key, id]) =>
        key === session.bookingAttemptKey && id === booking.bookingId,
    ) &&
    createPassengerSchema(session.selectedSeatIds).safeParse({
      contact: session.contact,
      passengers: session.passengers,
    }).success,
  );
}
function validBookings(snapshot: Snapshot): boolean {
  const bookings = snapshot.bookings,
    keys = snapshot.bookingKeys;
  return (
    new Set(bookings.map((item) => item.bookingId)).size === bookings.length &&
    new Set(bookings.map((item) => item.sessionId)).size === bookings.length &&
    new Set(keys.map(([key]) => key)).size === keys.length &&
    keys.every(([, id]) => bookings.some((item) => item.bookingId === id)) &&
    snapshot.sessions.every(
      (session) =>
        !session.bookingId ||
        bookings.some(
          (item) =>
            item.bookingId === session.bookingId &&
            item.sessionId === session.sessionId,
        ),
    ) &&
    bookings.every((b) => validBooking(snapshot, b))
  );
}

function restoreSnapshot(db: MockDb, snapshot: Snapshot): void {
  db.authSessions = new Map(
    snapshot.authSessions.map((grant) => [grant.token, grant]),
  );
  for (const session of snapshot.sessions) {
    db.sessions.set(session.sessionId, session);
    for (const seat of db.seats.get(session.tripId) ?? []) {
      if (!session.selectedSeatIds.includes(seat.id)) continue;
      seat.status = "held";
      db.holds.set(seat.id, session.sessionId);
    }
  }
  db.sessionKeys = new Map(snapshot.sessionKeys);
  db.bookings = new Map(
    snapshot.bookings.map((item) => [item.bookingId, item]),
  );
  db.bookingKeys = new Map(snapshot.bookingKeys);
  restorePaymentArchive(db, snapshot);
  restoreCancellationArchive(db, snapshot);
  db.ticketAccess = new Map(snapshot.ticketAccess.map((g) => [g.token, g]));
  for (const trip of db.trips)
    trip.availableSeatCount = (db.seats.get(trip.id) ?? []).filter(
      (seat) => seat.status === "available",
    ).length;
}

export function hydrateMockSnapshot(
  db: MockDb,
  nowMs: number,
  storage?: MockStorage,
): void {
  try {
    const raw = storage?.getItem(MOCK_BOOKING_STORAGE_KEY);
    if (raw === null || raw === undefined) return;
    if (raw.length > MAX_SNAPSHOT_LENGTH) return clearMockSnapshot(storage);
    const parsed = snapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return clearMockSnapshot(storage);
    const snapshot = pruneExpired(parsed.data, nowMs);
    if (!validSnapshot(db, snapshot, nowMs)) return clearMockSnapshot(storage);
    restoreSnapshot(db, snapshot);
    saveMockSnapshot(db, nowMs, storage);
  } catch {
    clearMockSnapshot(storage);
  }
}

function collectSnapshot(db: MockDb, nowMs: number): Snapshot | null {
  const sessions = [...db.sessions.values()].filter(
    (s): s is BookingSession & { status: "active" } =>
      s.status === "active" && Date.parse(s.expiresAt) > nowMs,
  );
  const archive = collectPaymentArchive(db, nowMs);
  const authSessions = [...db.authSessions.values()].filter(
    (grant) => Date.parse(grant.expiresAt) > nowMs,
  );
  if (!sessions.length && !archive.payments.length && !authSessions.length)
    return null;
  const sessionKeys = [...db.sessionKeys].filter(([, id]) =>
    sessions.some((s) => s.sessionId === id),
  );
  const bookings = [...db.bookings.values()].filter(
    (b) =>
      sessions.some((s) => s.sessionId === b.sessionId) ||
      archive.payments.some((p) => p.transaction.bookingId === b.bookingId),
  );
  const bookingKeys = [...db.bookingKeys].filter(([, id]) =>
    bookings.some((b) => b.bookingId === id),
  );
  return {
    version: 1,
    authSessions,
    ticketAccess: collectTicketAccess(db, nowMs),
    ...archive,
    ...collectCancellationArchive(db),
    sessions,
    sessionKeys,
    bookings,
    bookingKeys,
  };
}
export function saveMockSnapshot(
  db: MockDb,
  nowMs: number,
  storage?: MockStorage,
): void {
  const snapshot = collectSnapshot(db, nowMs);
  if (!snapshot) return clearMockSnapshot(storage);
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) return clearMockSnapshot(storage);
  const raw = JSON.stringify(parsed.data);
  if (raw.length > MAX_SNAPSHOT_LENGTH) return clearMockSnapshot(storage);
  try {
    storage?.setItem(MOCK_BOOKING_STORAGE_KEY, raw);
  } catch {
    clearMockSnapshot(storage);
  }
}
