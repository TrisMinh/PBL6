import type { ReactElement } from "react";
import { Link } from "react-router";

import failureShield from "@/assets/payment/failure-shield.svg";
import processingSafety from "@/assets/payment/processing-safety.svg";
import progressRail from "@/assets/payment/progress-rail.svg";
import statusDot from "@/assets/payment/status-dot.svg";
import { useSeats } from "@/features/booking/hooks/useSeats";
import { useHoldCountdown } from "@/features/booking/hooks/useHoldCountdown";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type {
  PaymentResult,
  PaymentStatus,
} from "@/features/payment/types/payment";
import { paymentVnPayPath, ticketPath, ROUTES } from "@/shared/config/routes";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { formatDateTime } from "@/shared/lib/formatDateTime";
import { Button } from "@/shared/ui/Button/Button";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";

import "./PaymentResultCard.css";

interface Props {
  result: PaymentResult;
  isFetching: boolean;
  onRecheck: () => void;
}
const LABELS: Record<PaymentStatus, string> = {
  success: "Đã xác nhận thanh toán",
  failed: "Chưa ghi nhận thanh toán",
  cancelled: "Giao dịch đã hủy",
  pending: "Đang chờ xác nhận",
};
const STATUS_EYEBROWS: Record<PaymentStatus, string> = {
  success: "ĐÃ XÁC NHẬN THANH TOÁN",
  failed: "GIAO DỊCH CHƯA HOÀN TẤT",
  cancelled: "GIAO DỊCH ĐÃ HỦY",
  pending: "ĐANG XỬ LÝ · TỰ ĐỘNG CẬP NHẬT",
};
function JourneyHeader({ result }: { result: PaymentResult }): ReactElement {
  const query = useSeats(result.tripId);
  return (
    <header className="payment-result__journey">
      <div className="payment-result__reference">
        <BrandLogo placement="header" className="payment-result__brand" />
        {result.status === "pending" ? (
          <img src={statusDot} alt="" aria-hidden="true" />
        ) : null}
        <strong>{STATUS_EYEBROWS[result.status]}</strong>
        <span className="payment-result__booking-code">
          <span aria-hidden="true">MÃ </span>
          <span>{result.bookingCode}</span>
        </span>
      </div>
      {query.data ? (
        <>
          <h2>
            {query.data.trip.origin.province} →{" "}
            {query.data.trip.destination.province}
          </h2>
          <p>
            {formatDateTime(query.data.trip.departureTime, "HH:mm dd/MM/yyyy")}{" "}
            · {query.data.trip.operator.name}
          </p>
        </>
      ) : (
        <>
          <h2>Thông tin chuyến đi</h2>
          {query.isError ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void query.refetch()}
            >
              Tải lại hành trình
            </Button>
          ) : (
            <p role="status">Đang tải hành trình…</p>
          )}
        </>
      )}
    </header>
  );
}
function PaymentDetails({ result }: { result: PaymentResult }): ReactElement {
  const recovery = result.status === "failed" || result.status === "cancelled";
  return (
    <section aria-label="Chi tiết giao dịch">
      <h3>{recovery ? "Giao dịch cần xử lý" : "Chi tiết giao dịch"}</h3>
      <dl className="payment-result__details">
        <div>
          <dt>Trạng thái</dt>
          <dd>{LABELS[result.status]}</dd>
        </div>
        <div>
          <dt>Số tiền</dt>
          <dd>{formatCurrencyVnd(result.amountVnd)}</dd>
        </div>
        <div>
          <dt>Cổng thanh toán</dt>
          <dd>VNPay mô phỏng</dd>
        </div>
        <div>
          <dt>Thời điểm tạo giao dịch</dt>
          <dd>{formatDateTime(result.createdAt, "HH:mm dd/MM/yyyy")}</dd>
        </div>
      </dl>
      <p className="payment-result__safety">
        <img
          src={recovery ? failureShield : processingSafety}
          alt=""
          aria-hidden="true"
        />
        <span>
          {result.status === "success"
            ? "Đã xác nhận dữ liệu giao dịch và phát hành vé mô phỏng."
            : recovery
              ? "Nếu tài khoản đã bị trừ tiền, đừng thanh toán lại. Hãy kiểm tra giao dịch trước để tránh thanh toán hai lần."
              : "Chưa phát hành vé. Không thực hiện lại giao dịch khi đang chờ xác nhận."}
        </span>
      </p>
      <p className="payment-result__notice">
        Đây là môi trường mô phỏng; không thu tiền thật.
      </p>
    </section>
  );
}
function TicketLinks({ result }: { result: PaymentResult }): ReactElement {
  return (
    <section aria-label="Vé đã phát hành">
      <h3>Vé đã phát hành</h3>
      <ul className="payment-result__tickets">
        {result.tickets.map((ticket) => (
          <li key={ticket.ticketId}>
            <span>Ghế {ticket.seatCode}</span>
            <Link to={ticketPath(ticket.ticketCode)}>
              Xem vé {ticket.ticketCode}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
function RecoveryActions({
  result,
  isFetching,
  onRecheck,
}: Props): ReactElement {
  const draft = useBookingDraftStore((s) => s.draft),
    countdown = useHoldCountdown(draft?.expiresAt ?? "");
  const canRetry =
    draft?.bookingId === result.bookingId &&
    draft.sessionId === result.sessionId &&
    !countdown.isExpired &&
    countdown.remainingSeconds > 0;
  return (
    <div className="payment-result__actions">
      {result.status !== "success" && (
        <Button type="button" isLoading={isFetching} onClick={onRecheck}>
          Kiểm tra giao dịch
        </Button>
      )}
      {["failed", "cancelled"].includes(result.status) && canRetry && (
        <Link to={paymentVnPayPath(result.bookingId)}>
          Chọn phương thức khác
        </Link>
      )}
      <Link to={ROUTES.accountTickets}>← Về hành trình của tôi</Link>
    </div>
  );
}
function PaymentProgress({ status }: { status: PaymentStatus }): ReactElement {
  return (
    <section aria-label="Tiến trình thanh toán">
      <h3>
        {status === "failed" || status === "cancelled"
          ? "Chọn cách xử lý"
          : "Tiến trình thanh toán"}
      </h3>
      {status === "pending" ? (
        <img
          className="payment-result__rail"
          src={progressRail}
          alt=""
          aria-hidden="true"
        />
      ) : null}
      <ol className="payment-result__progress">
        <li>Đã gửi yêu cầu</li>
        <li aria-current={status === "pending" ? "step" : undefined}>
          {status === "pending" ? "Đang xác nhận" : LABELS[status]}
        </li>
        <li>
          {status === "success" ? "Đã phát hành vé" : "Chưa phát hành vé"}
        </li>
      </ol>
    </section>
  );
}
export function PaymentResultCard(props: Props): ReactElement {
  return (
    <article
      className={[
        "payment-result",
        "payment-result--" + props.result.status,
      ].join(" ")}
      aria-label="Kết quả giao dịch"
    >
      <JourneyHeader result={props.result} />
      <div className="payment-result__body">
        <div>
          <PaymentDetails result={props.result} />
          {props.result.status === "success" && (
            <TicketLinks result={props.result} />
          )}
        </div>
        <aside className="payment-result__sidebar">
          <PaymentProgress status={props.result.status} />
          <RecoveryActions {...props} />
        </aside>
      </div>
    </article>
  );
}
