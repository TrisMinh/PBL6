import { z } from "zod";

export const refundSchema = z.object({
  id: z.guid(),
  refundReference: z.string(),
  paymentId: z.guid(),
  bookingId: z.guid(),
  amount: z.number().nonnegative(),
  currency: z.literal("VND"),
  status: z.string(),
  reason: z.string(),
  createdAt: z.iso.datetime({ offset: true }).nullish(),
  paymentProvider: z.string().nullish(),
  refundRequestId: z.guid().nullish(),
});

export type LiveRefund = z.infer<typeof refundSchema>;

export const REFUND_REFRESH_INTERVAL_MS = 2000;

export function isRefundPending(status?: string): boolean {
  return status === "REQUESTED" || status === "PROCESSING";
}

export const refundStates: Record<string, string> = {
  REQUESTED: "Đã tiếp nhận yêu cầu hoàn tiền",
  PROCESSING: "Đang xử lý hoàn tiền",
  SUCCEEDED: "Hoàn tiền thành công",
  FAILED: "Hoàn tiền thất bại",
  CANCELLED: "Yêu cầu hoàn tiền đã hủy",
};

export function isSimulatedRefund(provider?: string | null): boolean {
  return provider === "SIMULATOR" || provider === "VNPAY_SANDBOX";
}

export function refundStatusLabel(
  status: string,
  provider?: string | null,
): string {
  return status === "SUCCEEDED" && isSimulatedRefund(provider)
    ? "Đã hoàn trong mô phỏng"
    : (refundStates[status] ?? status);
}
