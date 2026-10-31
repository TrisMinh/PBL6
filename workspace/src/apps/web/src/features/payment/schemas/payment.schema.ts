import { z } from "zod";

import { paymentReturnPath } from "@/shared/config/routes";

export const paymentIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const paymentStatusSchema = z.enum([
  "pending",
  "success",
  "failed",
  "cancelled",
]);
export const paymentAttemptSchema = z
  .object({
    key: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/),
    scenario: paymentStatusSchema,
    transactionId: paymentIdSchema.optional(),
    resultId: paymentIdSchema.optional(),
  })
  .refine((v) => Boolean(v.transactionId) === Boolean(v.resultId))
  .readonly();
export const paymentReturnQuerySchema = z
  .object({ transactionId: paymentIdSchema, resultId: paymentIdSchema })
  .strict();
const transactionSchema = z.object({
  tripId: paymentIdSchema,
  bookingCode: z.string().regex(/^BLUE-[A-Z0-9-]{1,128}$/),
  transactionId: paymentIdSchema,
  resultId: paymentIdSchema,
  bookingId: paymentIdSchema,
  sessionId: paymentIdSchema,
  amountVnd: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  returnPath: z.string(),
});
function validTransaction(value: z.infer<typeof transactionSchema>): boolean {
  return (
    Date.parse(value.expiresAt) > Date.parse(value.createdAt) &&
    value.returnPath === paymentReturnPath(value.transactionId, value.resultId)
  );
}
export const paymentCreateSchema = transactionSchema
  .refine(validTransaction)
  .readonly();
export const ticketSummarySchema = z
  .object({
    ticketId: paymentIdSchema,
    ticketCode: z.string().regex(/^BLUE-[A-Z0-9-]{1,128}$/),
    bookingId: paymentIdSchema,
    tripId: paymentIdSchema,
    seatId: z.string().min(1).max(128),
    seatCode: z.string().regex(/^[AB]\d{2}$/),
    fareVnd: z.number().int().positive(),
    status: z.literal("issued"),
  })
  .readonly();
export const paymentResultSchema = transactionSchema
  .extend({
    status: paymentStatusSchema,
    tickets: z.array(ticketSummarySchema).max(6).readonly(),
  })
  .refine(validTransaction)
  .refine((value) => {
    if (value.status !== "success") return value.tickets.length === 0;
    const tickets = value.tickets;
    return (
      tickets.length > 0 &&
      new Set(tickets.map((t) => t.ticketId)).size === tickets.length &&
      new Set(tickets.map((t) => t.ticketCode)).size === tickets.length &&
      new Set(tickets.map((t) => t.seatId)).size === tickets.length &&
      new Set(tickets.map((t) => t.tripId)).size === 1 &&
      tickets.every(
        (t) => t.bookingId === value.bookingId && t.tripId === value.tripId,
      ) &&
      tickets.reduce((total, t) => total + t.fareVnd, 0) === value.amountVnd
    );
  })
  .readonly();
