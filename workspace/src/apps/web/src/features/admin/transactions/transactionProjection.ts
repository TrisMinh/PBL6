import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
} from "@/features/admin/types/admin";
import type {
  BookingViewState,
  PaymentViewState,
  RefundViewState,
} from "./transactionAudit.schema";

export const BOOKING_VIEW_LABELS = {
  "awaiting-refund": "Chờ hoàn tiền",
  paid: "Đã thanh toán",
  refunded: "Đã hoàn tiền",
  "pending-payment": "Chờ thanh toán",
  expired: "Hết hạn",
} satisfies Record<BookingViewState, string>;
export const PAYMENT_VIEW_LABELS = {
  "awaiting-refund": "Chờ hoàn tiền",
  success: "Thành công",
  "partially-refunded": "Hoàn một phần",
  pending: "Đang xử lý",
  failed: "Thất bại",
  cancelled: "Đã hủy",
} satisfies Record<PaymentViewState, string>;
export const REFUND_VIEW_LABELS = {
  processing: "Đang xử lý",
  completed: "Đã hoàn",
  failed: "Thất bại",
  queued: "Chờ xử lý",
} satisfies Record<RefundViewState, string>;

export function bookingLabel(item: AdminBooking): string {
  return item.audit
    ? BOOKING_VIEW_LABELS[item.audit.reservationState]
    : (
        {
          "pending-payment": "Chờ thanh toán",
          paid: "Đã thanh toán",
          cancelled: "Đã hủy",
        } satisfies Record<AdminBooking["status"], string>
      )[item.status];
}
export function paymentLabel(item: AdminPayment): string {
  return PAYMENT_VIEW_LABELS[item.audit?.collectionState ?? item.status];
}
export function refundLabel(item: AdminRefund): string {
  return REFUND_VIEW_LABELS[item.audit?.transferState ?? item.status];
}
export function transactionMoney(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}
export function transactionDate(value: string, time = false): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(time
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
      : {}),
  }).formatToParts(new Date(value));
  const part = (name: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === name)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")}${time ? ` · ${part("hour")}:${part("minute")}` : ""}`;
}
