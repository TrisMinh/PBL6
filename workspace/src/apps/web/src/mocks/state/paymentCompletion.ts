import {
  ticketSummarySchema,
  paymentResultSchema,
} from "@/features/payment/schemas/payment.schema";
import type { BookingSession } from "@/features/booking/types/booking";
import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";
import type { Ticket } from "@/features/tickets/types/ticket";
import type { PaymentResult } from "@/features/payment/types/payment";
import type { MockPayment } from "@/mocks/state/paymentState";
import type { PaymentContext } from "@/mocks/handlers/paymentHandlers";

function getGuestVerification(
  session: BookingSession,
): Ticket["guestVerification"] | null {
  return session.contact
    ? Object.freeze({
        email: session.contact.email,
        phone: session.contact.phone,
      })
    : null;
}
function issueTickets(
  context: PaymentContext,
  session: BookingSession,
  payment: MockPayment,
  booking: BookingCreationSummary,
): Ticket[] {
  const trip = context.db.trips.find((t) => t.id === session.tripId);
  const verification = getGuestVerification(session);
  if (!trip || !verification) return [];
  return session.selectedSeatIds.flatMap((seatId) => {
    const seat = context.db.seats
        .get(session.tripId)
        ?.find((s) => s.id === seatId),
      passenger = session.passengers.find((p) => p.seatId === seatId);
    if (!seat || !passenger) return [];
    const ticket = ticketSummarySchema.parse({
      ticketId: crypto.randomUUID(),
      ticketCode: "BLUE-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
      bookingId: booking.bookingId,
      tripId: session.tripId,
      seatId,
      seatCode: seat.code,
      fareVnd: trip.fareVnd,
      status: "issued",
    });
    return [
      Object.freeze({
        ...ticket,
        bookingCode: booking.bookingCode,
        transactionId: payment.transaction.transactionId,
        issuedAt: new Date(context.now()).toISOString(),
        passenger: Object.freeze({ ...passenger }),
        guestVerification: verification,
      }),
    ];
  });
}
export function completePayment(
  context: PaymentContext,
  session: BookingSession,
  payment: MockPayment,
  booking: BookingCreationSummary,
): PaymentResult | null {
  const tickets =
    payment.outcome === "success"
      ? issueTickets(context, session, payment, booking)
      : [];
  if (
    payment.outcome === "success" &&
    tickets.length !== session.selectedSeatIds.length
  )
    return null;
  const result = paymentResultSchema.parse({
    ...payment.transaction,
    status: payment.outcome,
    tickets,
  });
  if (result.status === "success") {
    for (const ticket of tickets)
      context.db.tickets.set(ticket.ticketId, ticket);
    for (const seat of context.db.seats.get(session.tripId) ?? [])
      if (session.selectedSeatIds.includes(seat.id)) {
        seat.status = "sold";
        context.db.holds.delete(seat.id);
      }
    context.db.paidBookings.add(booking.bookingId);
    session.status = "completed";
    delete session.contact;
    session.passengers = [];
  }
  payment.result = result;
  return result;
}
