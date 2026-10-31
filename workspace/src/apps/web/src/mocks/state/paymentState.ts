import type {
  PaymentResult,
  PaymentStatus,
  PaymentTransaction,
} from "@/features/payment/types/payment";

export interface MockPayment {
  readonly transaction: PaymentTransaction;
  readonly outcome: PaymentStatus;
  result?: PaymentResult;
}
