import type { ReactElement } from "react";

import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import type { PaymentStatus } from "@/features/payment/types/payment";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { MockPaymentGateway } from "./MockPaymentGateway";

import "./PaymentCheckout.css";

interface Props {
  draft: BookingDraft;
  layout: SeatLayout;
  isPending: boolean;
  onPay: (scenario: PaymentStatus) => void;
}
export function ProviderPanel({
  amount,
  label = "SePay mô phỏng",
}: {
  amount: number;
  label?: string;
}): ReactElement {
  return (
    <div className="payment-checkout__provider">
      <span>CỔNG THANH TOÁN</span>
      <strong>SePay Sandbox</strong>
      <span>SỐ TIỀN ĐƯỢC XÁC NHẬN</span>
      <strong className="payment-checkout__amount">
        {formatCurrencyVnd(amount)}
      </strong>
      <p>Phiên thanh toán hết hạn cùng thời gian giữ ghế.</p>
      <div className="payment-checkout__brand" aria-label={label}>
        <strong>SePay</strong>
        <span>SANDBOX · SECURE CHECKOUT</span>
      </div>
    </div>
  );
}
function TransactionDetails({ draft }: Pick<Props, "draft">): ReactElement {
  return (
    <div className="payment-checkout__details">
      <dl>
        <div>
          <dt>NHÀ CUNG CẤP</dt>
          <dd>SePay · Môi trường Sandbox</dd>
        </div>
        <div>
          <dt>MÃ ĐẶT CHỖ</dt>
          <dd>
            {draft.bookingId ?? "Đang xác nhận"} <span>Đã xác thực</span>
          </dd>
        </div>
        <div>
          <dt>TRẠNG THÁI</dt>
          <dd>Chờ khách hàng xác nhận</dd>
        </div>
        <div>
          <dt>SỐ TIỀN</dt>
          <dd>{formatCurrencyVnd(draft.totalVnd)}</dd>
        </div>
        <div className="payment-checkout__reference">
          <dt>MÃ THAM CHIẾU THANH TOÁN</dt>
          <dd>
            {draft.paymentAttempt?.transactionId ?? "Chưa có giao dịch"}
            <span>
              {draft.paymentAttempt?.transactionId ? "Đã tạo" : "Chưa tạo"}
            </span>
          </dd>
          <small>Mã do hệ thống tạo · không chỉnh sửa</small>
        </div>
      </dl>
    </div>
  );
}
export function PaymentCheckout(props: Props): ReactElement {
  return (
    <section className="payment-checkout" aria-label="SePay mô phỏng">
      <MockPaymentGateway
        inline
        amount={props.draft.totalVnd}
        bookingId={props.draft.bookingId ?? ""}
        pending={props.isPending}
        onPay={props.onPay}
      />
      <details className="payment-checkout__transaction-details">
        <summary>Thông tin giao dịch</summary>
        <TransactionDetails draft={props.draft} />
      </details>
    </section>
  );
}
