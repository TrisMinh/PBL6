import { HttpResponse } from "msw";

import { paymentReturnQuerySchema } from "@/features/payment/schemas/payment.schema";
import { bookingProblem, readBookingBody } from "@/mocks/handlers/bookingHttp";
import { paymentProblem } from "@/mocks/handlers/paymentHttp";
import type { PaymentContext } from "@/mocks/handlers/paymentHandlers";
import { isCompleteBookingSession } from "@/mocks/state/bookingCheckout";
import { requireActiveSession } from "@/mocks/state/bookingSeats";
import { completePayment } from "@/mocks/state/paymentCompletion";

const PATH = "/api/v1/payments/vnpay/return";
export async function postPaymentReturn(
  context: PaymentContext,
  request: Request,
): Promise<Response> {
  const body = await readBookingBody(
    request,
    paymentReturnQuerySchema,
    PATH,
    "transactionId",
  );
  if ("error" in body) return body.error;
  const payment = context.db.payments.get(body.data.transactionId);
  if (!payment || payment.transaction.resultId !== body.data.resultId)
    return bookingProblem("NOT_FOUND", PATH);
  if (payment.result && payment.result.status !== "pending")
    return HttpResponse.json(payment.result);
  const booking = context.db.bookings.get(payment.transaction.bookingId);
  if (!booking) return bookingProblem("NOT_FOUND", PATH);
  const session = requireActiveSession(
    context.db,
    booking.sessionId,
    context.now(),
    PATH,
  );
  if (session instanceof Response) return session;
  if (
    context.db.paidBookings.has(booking.bookingId) ||
    booking.totalVnd !== payment.transaction.amountVnd ||
    session.bookingId !== booking.bookingId ||
    !isCompleteBookingSession(context.db, session)
  )
    return paymentProblem("PAYMENT_NOT_ALLOWED", PATH);
  const result = completePayment(context, session, payment, booking);
  return result
    ? HttpResponse.json(result)
    : paymentProblem("PAYMENT_NOT_ALLOWED", PATH);
}
