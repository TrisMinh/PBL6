import { useId, type ReactElement, type ReactNode } from "react";
import { isMockApi } from "@/shared/api/config";
import { Link } from "react-router";

import busIcon from "@/assets/booking/passenger-review/bus.svg";
import pickupIcon from "@/assets/booking/passenger-review/pickup.svg";
import summaryBusIcon from "@/assets/booking/passenger-review/summary-bus.svg";
import paymentBusIcon from "@/assets/payment/summary-bus.svg";
import { canContinueBooking } from "@/features/booking/lib/canContinueBooking";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import type { HoldCountdown } from "@/features/booking/hooks/useHoldCountdown";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { Button } from "@/shared/ui/Button/Button";

import "./BookingSummary.css";

const BOOKING_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const BOOKING_DATE = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export interface BookingSummaryProps {
  paymentOptions?: ReactNode;
  secondaryAction?: ReactNode;
  draft: BookingDraft;
  layout: SeatLayout;
  countdown: HoldCountdown;
  isPending?: boolean;
  onContinue?: () => void;
  formId?: string;
  actionLabel?: string;
  hint?: string;
  isActionPending?: boolean;
  variant?: "default" | "passenger" | "review" | "payment";
  backHref?: string;
}
function SummaryDetails({
  draft,
  layout,
}: Pick<BookingSummaryProps, "draft" | "layout">): ReactElement {
  const selected = layout.items
    .filter((seat) => draft.selectedSeatIds.includes(seat.id))
    .map((seat) => seat.code);
  return (
    <dl className="booking-summary__details">
      <div>
        <dt>{layout.vehicleType === "cabin-22" ? "Phòng" : "Ghế"}</dt>
        <dd>{selected.join(", ") || "Chưa chọn"}</dd>
      </div>
      <div>
        <dt>Giá vé</dt>
        <dd>{formatCurrencyVnd(draft.totalVnd)}</dd>
      </div>
      <div className="booking-summary__total">
        <dt>Tổng cộng</dt>
        <dd aria-live="polite" aria-atomic="true">
          {formatCurrencyVnd(draft.totalVnd)}
        </dd>
      </div>
    </dl>
  );
}
function SummaryJourney({
  layout,
}: Pick<BookingSummaryProps, "layout">): ReactElement {
  return (
    <div className="booking-summary__journey">
      <strong>
        {layout.trip.origin.province} → {layout.trip.destination.province}
      </strong>
      <p>
        {BOOKING_TIME.format(new Date(layout.trip.departureTime))} ·{" "}
        {BOOKING_DATE.format(new Date(layout.trip.departureTime))} ·{" "}
        {layout.trip.operator.name}
      </p>
    </div>
  );
}
function SummaryHeader({
  titleId,
  clock,
  title,
}: {
  titleId: string;
  clock: string;
  title: string;
}): ReactElement {
  return (
    <header className="booking-summary__header">
      <h2 id={titleId}>{title}</h2>
      {isMockApi && (
        <span
          className="booking-summary__timer"
          role="timer"
          aria-label={
            isMockApi ? "Thời gian giữ chỗ" : "Thời gian hoàn tất bản nháp"
          }
          aria-live="off"
        >
          {clock}
        </span>
      )}
    </header>
  );
}

function OperatorSummary({
  layout,
  variant,
}: Pick<BookingSummaryProps, "layout" | "variant">): ReactElement {
  return (
    <div className="booking-summary__operator">
      <span className="booking-summary__operator-icon">
        <img
          alt=""
          aria-hidden="true"
          src={
            variant === "payment"
              ? paymentBusIcon
              : variant === "review"
                ? summaryBusIcon
                : busIcon
          }
        />
      </span>
      <div>
        <span className="booking-summary__eyebrow">
          {variant === "review" || variant === "payment"
            ? "NHÀ XE VẬN HÀNH"
            : "ĐƠN VỊ VẬN HÀNH"}
        </span>
        <strong>{layout.trip.operator.name}</strong>
        {layout.trip.id.length <= 24 && (
          <small>
            {variant === "review" || variant === "payment"
              ? `Đối tác vận hành · ${layout.trip.id}`
              : `Nhà xe đối tác của BLUE · ${layout.trip.id}`}
          </small>
        )}
      </div>
    </div>
  );
}

function DetailedJourney({
  draft,
  layout,
  variant,
}: Pick<BookingSummaryProps, "draft" | "layout" | "variant">): ReactElement {
  const trip = layout.trip;
  return (
    <div className="booking-summary__journey booking-summary__journey--detailed">
      <strong>
        {trip.origin.displayName} → {trip.destination.displayName}
      </strong>
      <p>
        {BOOKING_TIME.format(new Date(trip.departureTime))} ·{" "}
        {BOOKING_DATE.format(new Date(trip.departureTime))}
      </p>
      {variant === "review" || variant === "payment" ? (
        <b className="booking-summary__selection">
          {layout.items
            .filter((seat) => draft.selectedSeatIds.includes(seat.id))
            .map((seat) => seat.code)
            .join(", ")}{" "}
          · {draft.passengerCount} hành khách
        </b>
      ) : (
        <div className="booking-summary__pickup">
          <img alt="" aria-hidden="true" src={pickupIcon} />
          <b>{trip.originStopName}</b>
          <span>Đến {trip.destinationStopName}</span>
        </div>
      )}
    </div>
  );
}

function DetailedPrice({
  draft,
  layout,
  variant,
}: Pick<BookingSummaryProps, "draft" | "layout" | "variant">): ReactElement {
  const selected = layout.items
    .filter((seat) => draft.selectedSeatIds.includes(seat.id))
    .map((seat) => seat.code);
  return (
    <dl className="booking-summary__details booking-summary__details--detailed">
      {variant === "passenger" && (
        <div>
          <dt>Ghế</dt>
          <dd>{selected.join(", ")}</dd>
        </div>
      )}
      {variant === "passenger" && (
        <div>
          <dt>Hành khách</dt>
          <dd>{draft.passengerCount} người</dd>
        </div>
      )}
      <div>
        <dt>Giá vé</dt>
        <dd>{formatCurrencyVnd(draft.totalVnd)}</dd>
      </div>
      <div>
        <dt>Phí dịch vụ</dt>
        <dd>{formatCurrencyVnd(0)}</dd>
      </div>
      {(variant === "review" || variant === "payment") && (
        <div>
          <dt>{variant === "payment" ? "Giảm giá" : "Khuyến mãi"}</dt>
          <dd>{formatCurrencyVnd(0)}</dd>
        </div>
      )}
      <div className="booking-summary__total">
        <dt>
          {variant === "review" || variant === "payment"
            ? "Tổng thanh toán"
            : "Tổng cộng"}
        </dt>
        <dd aria-live="polite" aria-atomic="true">
          {formatCurrencyVnd(draft.totalVnd)}
        </dd>
      </div>
    </dl>
  );
}
export function BookingSummary({
  draft,
  layout,
  countdown,
  isPending = false,
  onContinue,
  formId,
  actionLabel = "Tiếp tục",
  hint,
  isActionPending,
  variant = "default",
  backHref,
  paymentOptions,
  secondaryAction,
}: BookingSummaryProps): ReactElement {
  const titleId = useId();
  const seconds = countdown.remainingSeconds;
  const clock =
    seconds === 0 && !countdown.isExpired
      ? "--:--"
      : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const isDetailed = variant !== "default";
  const title =
    variant === "review"
      ? "Tóm tắt thanh toán"
      : variant === "payment"
        ? "Đơn hàng của bạn"
        : "Chuyến đi của bạn";
  return (
    <aside
      className={`booking-summary booking-summary--${variant}`}
      aria-labelledby={titleId}
    >
      <SummaryHeader titleId={titleId} clock={clock} title={title} />
      {isDetailed ? (
        <>
          <OperatorSummary layout={layout} variant={variant} />
          <DetailedJourney draft={draft} layout={layout} variant={variant} />
        </>
      ) : (
        <SummaryJourney layout={layout} />
      )}
      {isDetailed ? (
        <DetailedPrice draft={draft} layout={layout} variant={variant} />
      ) : (
        <SummaryDetails draft={draft} layout={layout} />
      )}
      {paymentOptions ??
        (variant === "review" || variant === "payment" ? (
          <div className="booking-summary__payment-method">
            <span>
              {variant === "payment"
                ? "CỔNG THANH TOÁN"
                : "PHƯƠNG THỨC THANH TOÁN"}
            </span>
            <strong>
              {variant === "payment"
                ? "VNPay Sandbox"
                : "Chọn ở bước tiếp theo"}
            </strong>
            <small>
              {variant === "payment"
                ? "Xác nhận kết quả từ máy chủ"
                : "Thẻ · Ví điện tử · Chuyển khoản"}
            </small>
          </div>
        ) : null)}
      <Button
        type={formId ? "submit" : "button"}
        form={formId}
        isLoading={isActionPending ?? (Boolean(formId) && isPending)}
        disabled={
          !canContinueBooking(
            draft,
            layout,
            countdown,
            isPending,
            isMockApi || variant !== "review",
          )
        }
        onClick={onContinue}
      >
        {variant === "review"
          ? `${actionLabel} · ${formatCurrencyVnd(draft.totalVnd)}`
          : actionLabel}
      </Button>
      {variant === "payment" && backHref ? (
        <Link className="booking-summary__back" to={backHref}>
          Quay lại kiểm tra thông tin
        </Link>
      ) : null}
      {variant === "review" && backHref ? (
        <Link className="booking-summary__back" to={backHref}>
          Quay lại chỉnh sửa thông tin
        </Link>
      ) : null}
      <p className="booking-summary__hint">
        {hint ??
          `Chọn đúng ${draft.passengerCount} ghế để tiếp tục. Tối đa 6 ghế mỗi phiên.`}
      </p>
      {secondaryAction}
    </aside>
  );
}
