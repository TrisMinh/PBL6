import type { z } from "zod";

import type {
  paymentAttemptSchema,
  paymentCreateSchema,
  paymentResultSchema,
  paymentStatusSchema,
  ticketSummarySchema,
} from "@/features/payment/schemas/payment.schema";

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PaymentAttempt = z.infer<typeof paymentAttemptSchema>;
export type PaymentTransaction = z.infer<typeof paymentCreateSchema>;
export type PaymentResult = z.infer<typeof paymentResultSchema>;
export type IssuedTicketSummary = z.infer<typeof ticketSummarySchema>;
