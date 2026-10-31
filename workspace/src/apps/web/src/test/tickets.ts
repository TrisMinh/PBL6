import { httpPaymentRepository } from "@/features/payment/repositories/httpPaymentRepository";
import type { PaymentResult } from "@/features/payment/types/payment";
import { createReadyPayment } from "@/test/payment";

export async function issueTestTickets(): Promise<PaymentResult> {
  const { transaction } = await createReadyPayment();
  return httpPaymentRepository.resolve(
    transaction.transactionId,
    transaction.resultId,
  );
}
