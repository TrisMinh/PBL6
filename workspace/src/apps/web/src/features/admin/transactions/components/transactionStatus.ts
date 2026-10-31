import type {
  AdminBookingStatus,
  AdminPaymentStatus,
  AdminRefundStatus,
} from "@/features/admin/types/admin";
import type { StatusTone } from "@/shared/ui/StatusBadge/StatusBadge";

interface StatusPresentation {
  label: string;
  tone: StatusTone;
}

export const BOOKING_STATUS = {
  "pending-payment": { label: "Chờ thanh toán", tone: "warning" },
  paid: { label: "Đã thanh toán", tone: "success" },
  cancelled: { label: "Đã hủy", tone: "error" },
} satisfies Record<AdminBookingStatus, StatusPresentation>;

export const PAYMENT_STATUS = {
  pending: { label: "Đang xử lý", tone: "warning" },
  success: { label: "Thành công", tone: "success" },
  failed: { label: "Thất bại", tone: "error" },
  cancelled: { label: "Đã hủy", tone: "neutral" },
} satisfies Record<AdminPaymentStatus, StatusPresentation>;

export const REFUND_STATUS = {
  processing: { label: "Đang hoàn tiền", tone: "warning" },
  completed: { label: "Đã hoàn tiền", tone: "success" },
  failed: { label: "Hoàn tiền thất bại", tone: "error" },
} satisfies Record<AdminRefundStatus, StatusPresentation>;
