import { http, HttpResponse } from "msw";
import { z } from "zod";

import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";
import type { BookingSession } from "@/features/booking/types/booking";
import { postPaymentReturn } from "@/mocks/handlers/paymentReturn";
import { bookingAttemptKeySchema } from "@/features/booking/schemas/bookingCreation.schema";
import {
  paymentCreateSchema,
  paymentIdSchema,
  paymentStatusSchema,
} from "@/features/payment/schemas/payment.schema";
import type { PaymentStatus } from "@/features/payment/types/payment";
import { bookingProblem, readBookingBody } from "@/mocks/handlers/bookingHttp";
import { paymentProblem } from "@/mocks/handlers/paymentHttp";
import { isCompleteBookingSession } from "@/mocks/state/bookingCheckout";
import { requireActiveSession } from "@/mocks/state/bookingSeats";
import { mockDb, type MockDb } from "@/mocks/state/mockDb";
import { paymentReturnPath } from "@/shared/config/routes";

export interface PaymentHandlerOptions {
  db?: MockDb;
  now?: () => number;
  allowScenarios?: boolean;
}
export type PaymentContext = Required<PaymentHandlerOptions>;
const PATH = "/api/v1/payments/vnpay";
const bodySchema = z
  .object({
    bookingId: paymentIdSchema,
    scenario: paymentStatusSchema.optional(),
  })
  .strict();
function makeTransaction(
  context: PaymentContext,
  booking: BookingCreationSummary,
  session: BookingSession,
  scenario: PaymentStatus,
  key: string,
): Response {
  const transactionId = crypto.randomUUID(),
    resultId = crypto.randomUUID();
  const transaction = paymentCreateSchema.parse({
    transactionId,
    resultId,
    bookingId: booking.bookingId,
    bookingCode: booking.bookingCode,
    tripId: session.tripId,
    sessionId: session.sessionId,
    amountVnd: booking.totalVnd,
    expiresAt: session.expiresAt,
    createdAt: new Date(context.now()).toISOString(),
    returnPath: paymentReturnPath(transactionId, resultId),
  });
  context.db.payments.set(transactionId, { transaction, outcome: scenario });
  context.db.paymentKeys.set(key, transactionId);
  return HttpResponse.json(transaction, { status: 201 });
}
function createTransaction(
  context: PaymentContext,
  bookingId: string,
  scenario: PaymentStatus,
  key: string,
): Response {
  const { db } = context;
  const previousId = db.paymentKeys.get(key),
    previous = previousId ? db.payments.get(previousId) : undefined;
  if (previous)
    return previous.transaction.bookingId === bookingId &&
      previous.outcome === scenario
      ? HttpResponse.json(previous.transaction, { status: 201 })
      : paymentProblem("IDEMPOTENCY_CONFLICT", PATH);
  const booking = db.bookings.get(bookingId);
  if (!booking) return bookingProblem("NOT_FOUND", PATH);
  if (db.paidBookings.has(bookingId))
    return paymentProblem("PAYMENT_NOT_ALLOWED", PATH);
  const session = requireActiveSession(
    db,
    booking.sessionId,
    context.now(),
    PATH,
  );
  if (session instanceof Response) return session;
  if (
    session.bookingId !== bookingId ||
    session.totalVnd !== booking.totalVnd ||
    !isCompleteBookingSession(db, session)
  )
    return paymentProblem("PAYMENT_NOT_ALLOWED", PATH);
  const pending = [...db.payments.values()].some(
    (p) =>
      p.transaction.bookingId === bookingId &&
      (!p.result || p.result.status === "pending"),
  );
  if (pending) return paymentProblem("PAYMENT_IN_PROGRESS", PATH);
  return makeTransaction(context, booking, session, scenario, key);
}
async function postPayment(
  context: PaymentContext,
  request: Request,
): Promise<Response> {
  const body = await readBookingBody(request, bodySchema, PATH, "bookingId");
  if ("error" in body) return body.error;
  const key = bookingAttemptKeySchema.safeParse(
    request.headers.get("Idempotency-Key"),
  );
  const scenario = body.data.scenario ?? "success";
  if (
    !key.success ||
    (!context.allowScenarios && !["success", "cancelled"].includes(scenario))
  )
    return bookingProblem("VALIDATION_ERROR", PATH);
  return createTransaction(context, body.data.bookingId, scenario, key.data);
}
export function createPaymentHandlers(
  options: PaymentHandlerOptions = {},
): ReturnType<typeof http.post>[] {
  const context: PaymentContext = {
    db: options.db ?? mockDb,
    now: options.now ?? Date.now,
    allowScenarios:
      options.allowScenarios ??
      (!import.meta.env.PROD &&
        (import.meta.env.DEV || import.meta.env.MODE === "test")),
  };
  return [
    http.post(PATH, async ({ request }) => {
      context.db.hydrate(context.now());
      const response = await postPayment(context, request);
      if (response.ok || response.status === 410)
        context.db.save(context.now());
      return response;
    }),
    http.post(PATH + "/return", async ({ request }) => {
      context.db.hydrate(context.now());
      const response = await postPaymentReturn(context, request);
      if (response.ok || response.status === 410)
        context.db.save(context.now());
      return response;
    }),
  ];
}
export const paymentHandlers = createPaymentHandlers();
