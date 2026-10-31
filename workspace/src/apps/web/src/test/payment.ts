import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import type { BookingDraft } from "@/features/booking/types/booking";
import { httpPaymentRepository } from "@/features/payment/repositories/httpPaymentRepository";
import type {
  PaymentStatus,
  PaymentTransaction,
} from "@/features/payment/types/payment";
import { createReadyBookingSession } from "@/test/booking";

export async function createReadyPayment(
  scenario: PaymentStatus = "success",
): Promise<{ draft: BookingDraft; transaction: PaymentTransaction }> {
  const session = await createReadyBookingSession(),
    booking = await httpBookingRepository.createBooking(
      session.sessionId,
      "booking-key",
    );
  const transaction = await httpPaymentRepository.create(booking.bookingId, {
    key: "payment-key",
    scenario,
  });
  return {
    transaction,
    draft: {
      ...session,
      bookingId: booking.bookingId,
      paymentAttempt: {
        key: "payment-key",
        scenario,
        transactionId: transaction.transactionId,
        resultId: transaction.resultId,
      },
    },
  };
}
