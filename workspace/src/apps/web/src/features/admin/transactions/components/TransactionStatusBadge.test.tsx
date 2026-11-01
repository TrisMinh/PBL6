import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TransactionStatusBadge } from "@/features/admin/transactions/components/TransactionStatusBadge";
import {
  BOOKING_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
} from "@/features/admin/transactions/components/transactionStatus";

describe("TransactionStatusBadge", () => {
  it.each([
    ["booking", "pending-payment", "Chờ thanh toán", "warning"],
    ["booking", "paid", "Đã thanh toán", "success"],
    ["booking", "cancelled", "Đã hủy", "error"],
    ["payment", "pending", "Đang xử lý", "warning"],
    ["payment", "success", "Thành công", "success"],
    ["payment", "failed", "Thất bại", "error"],
    ["payment", "cancelled", "Đã hủy", "neutral"],
    ["refund", "processing", "Đang hoàn tiền", "warning"],
    ["refund", "completed", "Đã hoàn tiền", "success"],
    ["refund", "failed", "Hoàn tiền thất bại", "error"],
  ] as const)("maps %s/%s exhaustively", (kind, status, label, tone) => {
    const badge =
      kind === "booking" ? (
        <TransactionStatusBadge kind="booking" status={status} />
      ) : kind === "payment" ? (
        <TransactionStatusBadge kind="payment" status={status} />
      ) : (
        <TransactionStatusBadge kind="refund" status={status} />
      );
    render(badge);
    expect(screen.getByText(label)).toHaveClass(`status-badge--${tone}`);
  });

  it("keeps all canonical status maps explicit", () => {
    expect(Object.keys(BOOKING_STATUS)).toHaveLength(3);
    expect(Object.keys(PAYMENT_STATUS)).toHaveLength(4);
    expect(Object.keys(REFUND_STATUS)).toHaveLength(3);
  });
});
