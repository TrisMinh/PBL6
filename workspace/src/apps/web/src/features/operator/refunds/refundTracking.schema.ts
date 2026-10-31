import { z } from "zod";
import {
  refundRequestSchema,
  refundLevel,
  type RefundLevel,
} from "./refunds.schema";
export const REFUND_FEES: Record<Exclude<RefundLevel, "exception">, number> = {
  level1: 10,
  level2: 20,
  level3: 30,
};
export function estimateRefund(
  value: number | null,
  minutes: number,
): { fee: number; refund: number } | null {
  const level = refundLevel(minutes);
  if (value === null || level === "exception") return null;
  const fee = Math.round((value * REFUND_FEES[level]) / 100);
  return { fee, refund: value - fee };
}
export const refundTrackingSchema = refundRequestSchema
  .safeExtend({
    progressLayout: z.enum(["standard", "timeline"]).default("standard"),
    cancelledTickets: z.number().int().nonnegative(),
    cancellationValue: z.number().int().nonnegative().nullable(),
    paymentMethod: z.literal("VNPay").nullable(),
    refundReference: z.string().min(1).nullable(),
  })
  .refine(
    (v) => v.cancelledTickets <= v.seats.length,
    "Số vé đã hủy không hợp lệ.",
  );
export type RefundTracking = z.infer<typeof refundTrackingSchema>;
