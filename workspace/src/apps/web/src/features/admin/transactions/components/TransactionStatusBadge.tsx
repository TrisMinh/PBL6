import type { ReactElement } from "react";

import type {
  AdminBookingStatus,
  AdminPaymentStatus,
  AdminRefundStatus,
} from "@/features/admin/types/admin";
import {
  BOOKING_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
} from "@/features/admin/transactions/components/transactionStatus";
import { StatusBadge } from "@/shared/ui/StatusBadge/StatusBadge";

type TransactionStatusBadgeProps =
  | { kind: "booking"; status: AdminBookingStatus }
  | { kind: "payment"; status: AdminPaymentStatus }
  | { kind: "refund"; status: AdminRefundStatus };

export function TransactionStatusBadge(
  props: TransactionStatusBadgeProps,
): ReactElement {
  const presentation =
    props.kind === "booking"
      ? BOOKING_STATUS[props.status]
      : props.kind === "payment"
        ? PAYMENT_STATUS[props.status]
        : REFUND_STATUS[props.status];
  return (
    <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>
  );
}
