import {
  BOOKING_VIEW_LABELS,
  PAYMENT_VIEW_LABELS,
  REFUND_VIEW_LABELS,
} from "./transactionProjection";

export type TransactionResource = "bookings" | "payments" | "refunds";
export const TRANSACTION_CONFIG = {
  bookings: {
    title: "Đơn đặt vé",
    detailTitle: "Chi tiết đơn đặt vé",
    panel: "Danh sách đơn đặt vé",
    action: "Xem chi tiết",
    prefix: "BK",
    description:
      "Tra cứu đơn, hành khách và vé. Mở giao dịch liên quan khi cần kiểm tra thanh toán hoặc hoàn tiền.",
    placeholder: "Mã đơn, mã vé hoặc mã giao dịch",
    statuses: BOOKING_VIEW_LABELS,
  },
  payments: {
    title: "Thanh toán",
    detailTitle: "Chi tiết thanh toán",
    panel: "Danh sách giao dịch thanh toán",
    action: "Xem giao dịch",
    prefix: "PAY",
    description:
      "Theo dõi từng lần thu tiền: kết quả giao dịch, mã đối tác và thời điểm xử lý.",
    placeholder: "Payment ID, mã đơn, mã đối tác hoặc correlation ID",
    statuses: PAYMENT_VIEW_LABELS,
  },
  refunds: {
    title: "Hoàn tiền",
    detailTitle: "Chi tiết hoàn tiền",
    panel: "Danh sách khoản hoàn",
    action: "Xem khoản hoàn",
    prefix: "RF",
    description:
      "Theo dõi khoản hoàn từ thanh toán đã thu; trạng thái hoàn tiền độc lập với trạng thái hủy vé.",
    placeholder: "Refund ID, Payment ID, mã đơn hoặc correlation ID",
    statuses: REFUND_VIEW_LABELS,
  },
} as const;
export const TRANSACTION_ORGANIZATIONS = [
  { id: "ORG-001", label: "BlueLine Co." },
  { id: "ORG-002", label: "RedLine Express" },
  { id: "ORG-003", label: "Đà Lạt Travel" },
  { id: "ORG-004", label: "Sài Gòn Express" },
  { id: "ORG-006", label: "Hải Vân Transport" },
  { id: "ORG-007", label: "Mekong Bus" },
] as const;
