export const LIVE_TRANSACTION_STATUSES = {
  bookings: {
    "pending-payment": "Chờ thanh toán",
    confirmed: "Đã xác nhận",
    paid: "Đã thanh toán",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    expired: "Hết hạn",
    "awaiting-refund": "Chờ hoàn tiền",
    refunded: "Đã hoàn tiền",
  },
  payments: {
    pending: "Đang xử lý",
    success: "Thành công",
    failed: "Thất bại",
    cancelled: "Đã hủy",
    "awaiting-refund": "Chờ hoàn tiền",
    "partially-refunded": "Hoàn một phần",
    refunded: "Đã hoàn tiền",
  },
  refunds: {
    queued: "Chờ xử lý",
    processing: "Đang xử lý",
    completed: "Đã hoàn",
    failed: "Thất bại",
  },
} as const;

const STATES: Record<string, Record<string, string>> = {
  bookings: {
    PENDING_PAYMENT: "pending-payment",
    CONFIRMED: "confirmed",
    PAID: "paid",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
    EXPIRED: "expired",
    REFUND_PENDING: "awaiting-refund",
    REFUNDED: "refunded",
  },
  payments: {
    PENDING: "pending",
    PROCESSING: "pending",
    SUCCEEDED: "success",
    FAILED: "failed",
    CANCELLED: "cancelled",
    REFUND_PENDING: "awaiting-refund",
    PARTIALLY_REFUNDED: "partially-refunded",
    REFUNDED: "refunded",
  },
  refunds: {
    REQUESTED: "queued",
    PROCESSING: "processing",
    SUCCEEDED: "completed",
    COMPLETED: "completed",
    FAILED: "failed",
  },
};
export function liveTransactionStatus(
  resource: keyof typeof LIVE_TRANSACTION_STATUSES,
  raw: string,
): { state: string; label: string; rawStatus: string } {
  const state = STATES[resource][raw] ?? raw;
  const labels: Record<string, string> = LIVE_TRANSACTION_STATUSES[resource];
  return {
    state,
    label: labels[state] ?? (raw || "Chưa có trạng thái"),
    rawStatus: raw,
  };
}
