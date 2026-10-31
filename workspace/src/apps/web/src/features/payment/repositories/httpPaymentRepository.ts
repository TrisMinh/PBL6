import type { PaymentRepository } from "@/features/payment/repositories/paymentRepository";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { requestBooking } from "@/features/booking/repositories/bookingHttp";
import {
  paymentAttemptSchema,
  paymentCreateSchema,
  paymentIdSchema,
  paymentResultSchema,
  paymentReturnQuerySchema,
} from "@/features/payment/schemas/payment.schema";

export const httpPaymentRepository: PaymentRepository = {
  create: async (bookingId, attempt, signal) => {
    if (
      !paymentIdSchema.safeParse(bookingId).success ||
      !paymentAttemptSchema.safeParse(attempt).success
    )
      throw new BookingRepositoryError("VALIDATION_ERROR", 400);
    const transaction = await requestBooking(
      "/api/v1/payments/vnpay",
      paymentCreateSchema,
      {
        method: "POST",
        body: {
          bookingId,
          ...(attempt.scenario === "success"
            ? {}
            : { scenario: attempt.scenario }),
        },
        idempotencyKey: attempt.key,
        signal,
        expectedStatus: 201,
      },
    );
    if (transaction.bookingId !== bookingId)
      throw new BookingRepositoryError("INVALID_RESPONSE", 201);
    return transaction;
  },
  resolve: async (transactionId, resultId, signal) => {
    const parsed = paymentReturnQuerySchema.safeParse({
      transactionId,
      resultId,
    });
    if (!parsed.success)
      throw new BookingRepositoryError("VALIDATION_ERROR", 400);
    const result = await requestBooking(
      "/api/v1/payments/vnpay/return",
      paymentResultSchema,
      { method: "POST", body: parsed.data, signal, expectedStatus: 200 },
    );
    if (result.transactionId !== transactionId || result.resultId !== resultId)
      throw new BookingRepositoryError("INVALID_RESPONSE", 200);
    return result;
  },
};
