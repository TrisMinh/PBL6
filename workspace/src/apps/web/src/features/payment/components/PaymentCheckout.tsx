import type { ReactElement } from "react";

import paymentSafetyIcon from "@/assets/payment/payment-safety.svg";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import type { PaymentStatus } from "@/features/payment/types/payment";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { Button } from "@/shared/ui/Button/Button";

import "./PaymentCheckout.css";

interface Props {
  draft: BookingDraft;
  layout: SeatLayout;
  isPending: boolean;
  onPay: (scenario: PaymentStatus) => void;
}
function ProviderPanel({ amount }: { amount: number }): ReactElement {
  return (
    <div className="payment-checkout__provider">
      <span>CỔNG THANH TOÁN</span>
      <strong>VNPay Sandbox</strong>
      <span>SỐ TIỀN ĐƯỢC XÁC NHẬN</span>
      <strong className="payment-checkout__amount">
        {formatCurrencyVnd(amount)}
      </strong>
      <p>Phiên thanh toán hết hạn cùng thời gian giữ ghế.</p>
      <div className="payment-checkout__brand" aria-label="VNPay mô phỏng">
        <strong>VNPAY</strong>
        <span>SANDBOX · SECURE CHECKOUT</span>
      </div>
    </div>
  );
}
function TransactionDetails({ draft }: Pick<Props, "draft">): ReactElement {
  return (
    <div className="payment-checkout__details">
      <h3>Thông tin giao dịch</h3>
      <p>Dữ liệu do máy chủ BLUE tạo riêng cho đơn đặt vé này.</p>
      <dl>
        <div>
          <dt>NHÀ CUNG CẤP</dt>
          <dd>VNPay · Môi trường Sandbox</dd>
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
            {draft.paymentAttempt?.transactionId ?? "Được tạo khi tiếp tục"}
            <span>Đã tạo</span>
          </dd>
          <small>Mã do hệ thống tạo · không chỉnh sửa</small>
        </div>
      </dl>
    </div>
  );
}
const SCENARIOS: readonly { status: PaymentStatus; label: string }[] = [
  { status: "success", label: "Mô phỏng thành công" },
  { status: "failed", label: "Mô phỏng thất bại" },
  { status: "cancelled", label: "Mô phỏng hủy" },
  { status: "pending", label: "Mô phỏng chờ xác nhận" },
];
function ScenarioActions({
  draft,
  isPending,
  onPay,
}: Pick<Props, "draft" | "isPending" | "onPay">): ReactElement | null {
  if (draft.paymentAttempt) return null;
  const isDevelopment =
    !import.meta.env.PROD &&
    (import.meta.env.DEV || import.meta.env.MODE === "test");
  return (
    <div className="payment-checkout__actions">
      {isDevelopment ? (
        <fieldset disabled={isPending}>
          <legend>Kịch bản thử nghiệm · Không thu tiền thật</legend>
          {SCENARIOS.map((s) => (
            <Button
              key={s.status}
              variant="secondary"
              type="button"
              onClick={() => onPay(s.status)}
            >
              {s.label}
            </Button>
          ))}
        </fieldset>
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => onPay("cancelled")}
        >
          Hủy thanh toán
        </Button>
      )}
    </div>
  );
}
export function PaymentCheckout(props: Props): ReactElement {
  return (
    <section className="payment-checkout" aria-label="VNPay mô phỏng">
      <header className="payment-checkout__intro">
        <h2>Thanh toán an toàn qua VNPay</h2>
        <p>
          Bạn sẽ được chuyển tới VNPay Sandbox để chọn ngân hàng và xác nhận
          giao dịch.
        </p>
      </header>
      <div className="payment-checkout__grid">
        <ProviderPanel amount={props.draft.totalVnd} />
        <TransactionDetails draft={props.draft} />
      </div>
      <div className="payment-checkout__safety">
        <img src={paymentSafetyIcon} alt="" aria-hidden="true" />
        <div>
          <strong>Kiểm tra đúng số tiền trước khi chuyển tới VNPay</strong>
          <p>
            Sau khi quay lại, BLUE sẽ kiểm tra trạng thái từ máy chủ — không dựa
            vào nội dung redirect.
          </p>
        </div>
      </div>
      <ScenarioActions {...props} />
    </section>
  );
}
