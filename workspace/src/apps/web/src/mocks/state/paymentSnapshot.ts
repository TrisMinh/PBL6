import { z } from "zod";

import { bookingAttemptKeySchema } from "@/features/booking/schemas/bookingCreation.schema";
import {
  passengerDraftSchema,
  contactDraftSchema,
} from "@/features/booking/schemas/passenger.schema";
import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";
import type { BookingSession } from "@/features/booking/types/booking";
import {
  paymentCreateSchema,
  paymentResultSchema,
  paymentStatusSchema,
  ticketSummarySchema,
  paymentIdSchema,
} from "@/features/payment/schemas/payment.schema";
import type { MockDb } from "@/mocks/state/mockDb";
import type { IssuedTicketSummary } from "@/features/payment/types/payment";

export const PAYMENT_RECEIPT_TTL_MS = 86_400_000;
const ticketSchema = ticketSummarySchema
  .unwrap()
  .extend({
    status: z.enum(["issued", "cancelled"]),
    bookingCode: z.string().regex(/^BLUE-[A-Z0-9-]{1,128}$/),
    transactionId: paymentIdSchema,
    issuedAt: z.iso.datetime(),
    passenger: passengerDraftSchema.readonly(),
    guestVerification: contactDraftSchema
      .pick({ email: true, phone: true })
      .strict()
      .readonly(),
  })
  .strict()
  .readonly();
const recordSchema = z
  .object({
    transaction: paymentCreateSchema,
    outcome: paymentStatusSchema,
    result: paymentResultSchema.optional(),
  })
  .strict();
export const paymentArchiveShape = {
  payments: z.array(recordSchema).max(100).default([]),
  paymentKeys: z
    .array(z.tuple([bookingAttemptKeySchema, paymentIdSchema]))
    .max(100)
    .default([]),
  tickets: z.array(ticketSchema).max(600).default([]),
};
export type PaymentArchive = z.infer<z.ZodObject<typeof paymentArchiveShape>>;
function validRecord(
  db: MockDb,
  record: PaymentArchive["payments"][number],
  bookings: readonly BookingCreationSummary[],
  sessions: readonly BookingSession[],
  now: number,
): boolean {
  const { transaction: tx, result } = record,
    booking = bookings.find((b) => b.bookingId === tx.bookingId);
  if (
    !db.trips.some((t) => t.id === tx.tripId) ||
    !booking ||
    booking.bookingCode !== tx.bookingCode ||
    booking.sessionId !== tx.sessionId ||
    booking.totalVnd !== tx.amountVnd ||
    Date.parse(tx.createdAt) > now ||
    Date.parse(tx.createdAt) + PAYMENT_RECEIPT_TTL_MS <= now ||
    Date.parse(tx.expiresAt) - Date.parse(tx.createdAt) > 600000
  )
    return false;
  if (
    result &&
    (result.status !== record.outcome ||
      JSON.stringify(paymentCreateSchema.parse(result)) !== JSON.stringify(tx))
  )
    return false;
  if (!result || result.status === "pending")
    return sessions.some(
      (s) =>
        s.tripId === tx.tripId &&
        s.sessionId === tx.sessionId &&
        s.bookingId === tx.bookingId &&
        s.expiresAt === tx.expiresAt,
    );
  return true;
}
function matchesIssuedSummary(
  ticket: PaymentArchive["tickets"][number],
  candidate: IssuedTicketSummary,
): boolean {
  return (
    candidate.ticketId === ticket.ticketId &&
    candidate.ticketCode === ticket.ticketCode &&
    candidate.bookingId === ticket.bookingId &&
    candidate.tripId === ticket.tripId &&
    candidate.seatId === ticket.seatId &&
    candidate.seatCode === ticket.seatCode &&
    candidate.fareVnd === ticket.fareVnd
  );
}
function validTicket(
  db: MockDb,
  archive: PaymentArchive,
  ticket: PaymentArchive["tickets"][number],
  bookings: readonly BookingCreationSummary[],
): boolean {
  const record = archive.payments.find(
      (p) => p.transaction.transactionId === ticket.transactionId,
    ),
    trip = db.trips.find((t) => t.id === ticket.tripId),
    booking = bookings.find((b) => b.bookingId === ticket.bookingId);
  const seat = db.seats.get(ticket.tripId)?.find((s) => s.id === ticket.seatId);
  return Boolean(
    record?.result?.status === "success" &&
    trip &&
    booking &&
    JSON.stringify(ticket.guestVerification) ===
      JSON.stringify(
        archive.tickets.find((t) => t.bookingId === ticket.bookingId)
          ?.guestVerification,
      ) &&
    booking.bookingCode === ticket.bookingCode &&
    record.transaction.tripId === ticket.tripId &&
    seat?.status === "available" &&
    seat.code === ticket.seatCode &&
    ticket.passenger.seatId === ticket.seatId &&
    trip.fareVnd === ticket.fareVnd &&
    Date.parse(ticket.issuedAt) >= Date.parse(record.transaction.createdAt) &&
    Date.parse(ticket.issuedAt) < Date.parse(record.transaction.expiresAt) &&
    record.result.tickets.some((candidate) =>
      matchesIssuedSummary(ticket, candidate),
    ),
  );
}
function validArchiveIds(archive: PaymentArchive): boolean {
  const { payments, paymentKeys, tickets } = archive,
    paid = payments.filter((p) => p.result?.status === "success");
  return (
    new Set(paid.map((p) => p.transaction.bookingId)).size === paid.length &&
    new Set(payments.map((p) => p.transaction.transactionId)).size ===
      payments.length &&
    new Set(payments.map((p) => p.transaction.resultId)).size ===
      payments.length &&
    new Set(paymentKeys.map(([key]) => key)).size === paymentKeys.length &&
    new Set(tickets.map((t) => t.ticketId)).size === tickets.length &&
    new Set(tickets.map((t) => t.ticketCode)).size === tickets.length &&
    new Set(tickets.map((t) => t.seatId)).size === tickets.length
  );
}
function validArchiveLinks(
  archive: PaymentArchive,
  sessions: readonly BookingSession[],
  bookings: readonly BookingCreationSummary[],
): boolean {
  const { payments, paymentKeys, tickets } = archive;
  return (
    paymentKeys.every(([, id]) =>
      payments.some((p) => p.transaction.transactionId === id),
    ) &&
    payments.every((p) =>
      paymentKeys.some(([, id]) => id === p.transaction.transactionId),
    ) &&
    payments.every(
      (p) =>
        p.result?.tickets.every((t) =>
          tickets.some(
            (item) =>
              item.ticketId === t.ticketId &&
              item.transactionId === p.transaction.transactionId,
          ),
        ) ?? true,
    ) &&
    sessions.every((s) =>
      s.selectedSeatIds.every((id) => !tickets.some((t) => t.seatId === id)),
    ) &&
    bookings.every(
      (b) =>
        sessions.some((s) => s.sessionId === b.sessionId) ||
        payments.some(
          (p) =>
            p.transaction.bookingId === b.bookingId &&
            p.result &&
            p.result.status !== "pending",
        ),
    )
  );
}
export function validPaymentArchive(
  db: MockDb,
  archive: PaymentArchive,
  bookings: readonly BookingCreationSummary[],
  sessions: readonly BookingSession[],
  now: number,
): boolean {
  return (
    validArchiveIds(archive) &&
    validArchiveLinks(archive, sessions, bookings) &&
    archive.payments.every((p) =>
      validRecord(db, p, bookings, sessions, now),
    ) &&
    archive.tickets.every((t) => validTicket(db, archive, t, bookings))
  );
}

export function collectPaymentArchive(db: MockDb, now: number): PaymentArchive {
  const payments = [...db.payments.values()].filter(
    (p) =>
      Date.parse(p.transaction.createdAt) + PAYMENT_RECEIPT_TTL_MS > now &&
      ((p.result && p.result.status !== "pending") ||
        Date.parse(p.transaction.expiresAt) > now),
  );
  const paymentKeys = [...db.paymentKeys].filter(([, id]) =>
    payments.some((p) => p.transaction.transactionId === id),
  );
  const tickets = [...db.tickets.values()].filter((t) =>
    payments.some((p) => p.transaction.transactionId === t.transactionId),
  );
  return { payments, paymentKeys, tickets };
}
export function restorePaymentArchive(
  db: MockDb,
  archive: PaymentArchive,
): void {
  db.payments = new Map(
    archive.payments.map((p) => [p.transaction.transactionId, p]),
  );
  db.paymentKeys = new Map(archive.paymentKeys);
  db.tickets = new Map(archive.tickets.map((t) => [t.ticketId, t]));
  db.paidBookings = new Set(
    archive.payments
      .filter((p) => p.result?.status === "success")
      .map((p) => p.transaction.bookingId),
  );
  for (const ticket of archive.tickets) {
    const seat = db.seats
      .get(ticket.tripId)
      ?.find((s) => s.id === ticket.seatId);
    if (seat) seat.status = "sold";
  }
}
