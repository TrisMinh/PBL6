import type {
  PaymentAttempt,
  PaymentResult,
  PaymentTransaction,
} from "@/features/payment/types/payment";

export interface PaymentRepository {
  create(
    bookingId: string,
    attempt: PaymentAttempt,
    signal?: AbortSignal,
  ): Promise<PaymentTransaction>;
  resolve(
    transactionId: string,
    resultId: string,
    signal?: AbortSignal,
  ): Promise<PaymentResult>;
}
