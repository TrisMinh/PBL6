import { discoveryTrips } from "@/mocks/fixtures/demoTrips";
import type { Ticket } from "@/features/tickets/types/ticket";
import type { MockAuthGrant } from "@/mocks/state/authState";
import type { MockTicketAccess } from "@/mocks/state/ticketAccessState";
import type { MockPayment } from "@/mocks/state/paymentState";
import type { CancellationState } from "@/mocks/state/cancellationState";
import type { BookingSession } from "@/features/booking/types/booking";
import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";
import type { Seat } from "@/features/booking/types/seat";
import type { Trip } from "@/features/trips/types/trip";
import { seatLayouts } from "@/mocks/fixtures/seats";
import { trips } from "@/mocks/fixtures/trips";
import {
  browserMockStorage,
  clearMockSnapshot,
  hydrateMockSnapshot,
  saveMockSnapshot,
  type MockStorage,
} from "@/mocks/state/mockSnapshot";

export interface MockDb extends CancellationState {
  trips: Trip[];
  seats: Map<string, Seat[]>;
  sessions: Map<string, BookingSession>;
  holds: Map<string, string>;
  sessionKeys: Map<string, string>;
  bookings: Map<string, BookingCreationSummary>;
  bookingKeys: Map<string, string>;
  payments: Map<string, MockPayment>;
  paymentKeys: Map<string, string>;
  tickets: Map<string, Ticket>;
  paidBookings: Set<string>;
  ticketAccess: Map<string, MockTicketAccess>;
  authSessions: Map<string, MockAuthGrant>;
  reset: () => void;
  hydrate: (nowMs: number) => void;
  save: (nowMs: number) => void;
}

export function createMockDb(
  options: { storage?: MockStorage; trips?: readonly Readonly<Trip>[] } = {},
): MockDb {
  let hydrated = false;
  const db: MockDb = {
    trips: [],
    seats: new Map(),
    sessions: new Map(),
    holds: new Map(),
    sessionKeys: new Map(),
    bookings: new Map(),
    bookingKeys: new Map(),
    payments: new Map(),
    paymentKeys: new Map(),
    tickets: new Map(),
    paidBookings: new Set(),
    ticketAccess: new Map(),
    authSessions: new Map(),
    refunds: new Map(),
    cancellationKeys: new Map(),
    reset: () => {
      resetDb(db, options.trips ?? trips);
      hydrated = true;
      clearMockSnapshot(options.storage);
    },
    hydrate: (nowMs) => {
      if (hydrated) return;
      hydrated = true;
      hydrateMockSnapshot(db, nowMs, options.storage);
    },
    save: (nowMs) => saveMockSnapshot(db, nowMs, options.storage),
  };
  resetDb(db, options.trips ?? trips);
  return db;
}

function seatsForTrip(trip: Trip): Seat[] {
  let remaining = trip.availableSeatCount;
  return seatLayouts[trip.vehicleType].map((seed) => {
    const seat = { ...structuredClone(seed), id: `${trip.id}:${seed.code}` };
    if (seat.status === "available") {
      if (remaining > 0) remaining--;
      else seat.status = "sold";
    }
    return seat;
  });
}

function resetDb(db: MockDb, source: readonly Readonly<Trip>[]): void {
  db.trips = source.map((trip) => structuredClone(trip));
  db.seats = new Map(db.trips.map((trip) => [trip.id, seatsForTrip(trip)]));
  db.sessions.clear();
  db.holds.clear();
  db.sessionKeys.clear();
  db.bookings.clear();
  db.bookingKeys.clear();
  db.payments.clear();
  db.paymentKeys.clear();
  db.tickets.clear();
  db.paidBookings.clear();
  db.ticketAccess.clear();
  db.authSessions.clear();
  db.refunds.clear();
  db.cancellationKeys.clear();
}

export const mockDb = createMockDb({
  storage: browserMockStorage,
  trips: discoveryTrips,
});
