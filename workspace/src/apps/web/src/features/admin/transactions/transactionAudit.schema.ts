import { z } from "zod";

const money = z.number().int().nonnegative();
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const bookingViewStateSchema = z.enum([
  "awaiting-refund",
  "paid",
  "refunded",
  "pending-payment",
  "expired",
]);
export const paymentViewStateSchema = z.enum([
  "awaiting-refund",
  "success",
  "partially-refunded",
  "pending",
  "failed",
  "cancelled",
]);
export const refundViewStateSchema = z.enum([
  "processing",
  "completed",
  "failed",
  "queued",
]);
const common = z
  .object({
    organizationName: z.string().min(1).max(120),
    history: z
      .array(
        z
          .object({
            occurredAt: z.iso.datetime(),
            description: z.string().min(1).max(500),
          })
          .strict(),
      )
      .max(100),
    collectedVnd: money,
    refundedVnd: money,
  })
  .strict();

export const bookingAuditSchema = common
  .extend({
    reservationState: bookingViewStateSchema,
    departureAt: z.iso.datetime(),
    seats: z.array(z.string().min(1).max(20)).min(1).max(6),
    ticketState: z.enum(["cancelled", "issued", "not-issued", "refunded"]),
    paymentId: id,
    paymentState: paymentViewStateSchema,
    refundId: id.optional(),
    refundRequestedVnd: money,
    refundState: refundViewStateSchema.optional(),
  })
  .strict();

export const paymentAuditSchema = common
  .extend({
    collectionState: paymentViewStateSchema,
    provider: z.string().min(1).max(100),
    partnerCode: z.string().min(1).max(128).optional(),
    requestedBy: z.string().min(1).max(100),
    correlationId: id,
    refundId: id.optional(),
    verification: z.enum(["verified", "waiting", "failed"]),
  })
  .strict();

export const refundAuditSchema = common
  .extend({
    transferState: refundViewStateSchema,
    reason: z.enum(["customer-cancellation", "operator-cancellation"]),
    requestedVia: z.string().min(1).max(100),
    correlationId: id,
    cancelledTicketVnd: money,
    cancellationFeeVnd: money,
    expectedRefundVnd: money,
  })
  .strict();

export type BookingAudit = z.infer<typeof bookingAuditSchema>;
export type PaymentAudit = z.infer<typeof paymentAuditSchema>;
export type RefundAudit = z.infer<typeof refundAuditSchema>;
export type BookingViewState = z.infer<typeof bookingViewStateSchema>;
export type PaymentViewState = z.infer<typeof paymentViewStateSchema>;
export type RefundViewState = z.infer<typeof refundViewStateSchema>;
