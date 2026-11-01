import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";

import passengerIcon from "@/assets/booking/passenger-review/passenger.svg";
import phoneIcon from "@/assets/booking/passenger-review/phone.svg";
import pickupIcon from "@/assets/booking/passenger-review/review-pickup.svg";
import policyIcon from "@/assets/booking/passenger-review/policy.svg";
import quoteIcon from "@/assets/booking/passenger-review/quote.svg";
import reviewBusIcon from "@/assets/booking/passenger-review/review-bus.svg";
import timelineBusIcon from "@/assets/booking/passenger-review/timeline-bus.svg";
import verifiedIcon from "@/assets/booking/passenger-review/verified.svg";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import {
  bookingPassengersPath,
  bookingSeatsPath,
} from "@/shared/config/routes";

import "./BookingReview.css";

export interface BookingReviewProps {
  routeOptions?: ReactNode;
  draft: BookingDraft;
  layout: SeatLayout;
}
const BOOKING_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function tripDuration(departureTime: string, arrivalTime: string): string {
  const minutes = Math.round(
    (new Date(arrivalTime).getTime() - new Date(departureTime).getTime()) /
      60_000,
  );
  return `${Math.floor(minutes / 60)} giờ ${String(minutes % 60).padStart(2, "0")} · Đi thẳng`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 5) return "••• ••• •••";
  return `${digits.slice(0, 2)}•• ••• ${digits.slice(-3)}`;
}
function checkInTime(departureTime: string): string {
  return BOOKING_TIME.format(
    new Date(new Date(departureTime).getTime() - 20 * 60 * 1000),
  );
}
function ReviewJourney({ draft, layout }: BookingReviewProps): ReactElement {
  const trip = layout.trip;
  return (
    <section className="booking-review__card" aria-label="Hành trình & nhà xe">
      <header className="booking-review__card-heading">
        <h2>Hành trình &amp; nhà xe</h2>
        {!draft.bookingId && (
          <Link
            aria-label="Chỉnh sửa ghế"
            to={bookingSeatsPath(draft.sessionId)}
          >
            Chỉnh sửa
          </Link>
        )}
      </header>
      <div className="booking-review__operator">
        <span className="booking-review__operator-icon">
          <img alt="" aria-hidden="true" src={reviewBusIcon} />
        </span>
        <div>
          <span>ĐƠN VỊ VẬN HÀNH</span>
          <strong>{trip.operator.name}</strong>
          {trip.id.length <= 24 && <small>Mã chuyến {trip.id}</small>}
        </div>
      </div>
      <div className="booking-review__journey">
        <div>
          <strong>{BOOKING_TIME.format(new Date(trip.departureTime))}</strong>
          <span>{trip.origin.displayName}</span>
          <span>{trip.originStopName}</span>
        </div>
        <div className="booking-review__timeline" aria-hidden="true">
          <img alt="" src={timelineBusIcon} />
          <small>{tripDuration(trip.departureTime, trip.arrivalTime)}</small>
        </div>
        <div>
          <strong>{BOOKING_TIME.format(new Date(trip.arrivalTime))}</strong>
          <span>{trip.destination.displayName}</span>
          <span>{trip.destinationStopName}</span>
        </div>
      </div>
    </section>
  );
}
function ReviewPassengers({
  draft,
  layout,
  routeOptions,
}: BookingReviewProps): ReactElement {
  return (
    <section
      className="booking-review__card"
      aria-label="Hành khách và điểm đón"
    >
      <header className="booking-review__card-heading">
        <h2>Hành khách &amp; điểm đón chung</h2>
        {!draft.bookingId && (
          <Link
            aria-label="Chỉnh sửa hành khách"
            to={bookingPassengersPath(draft.sessionId)}
          >
            Chỉnh sửa
          </Link>
        )}
      </header>
      <ul
        className="booking-review__passengers"
        aria-label="Hành khách theo ghế"
      >
        {draft.selectedSeatIds.map((id) => {
          const passenger = draft.passengers.find((item) => item.seatId === id);
          const seat = layout.items.find((item) => item.id === id);
          return (
            <li key={id}>
              <span className="booking-review__seat">{seat?.code}</span>
              <img
                alt=""
                aria-hidden="true"
                className="booking-review__passenger-icon"
                src={passengerIcon}
              />
              <strong>{passenger?.fullName}</strong>
              {(passenger?.phone || draft.contact?.phone) && (
                <>
                  <span className="booking-review__passenger-divider" />
                  <img
                    alt=""
                    aria-hidden="true"
                    className="booking-review__phone-icon"
                    src={phoneIcon}
                  />
                  <span>
                    {maskPhone(passenger?.phone || draft.contact?.phone || "")}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {routeOptions}
      <p className="booking-review__pickup">
        <img alt="" aria-hidden="true" src={pickupIcon} />
        <span>
          <strong>{layout.trip.originStopName}</strong>
          <small>{layout.trip.origin.displayName}</small>
        </span>
        <b>Có mặt {checkInTime(layout.trip.departureTime)}</b>
      </p>
    </section>
  );
}
function ReviewPolicy(): ReactElement {
  return (
    <section className="booking-review__card" aria-label="Điều kiện đặt vé">
      <h2>Điều kiện đặt vé</h2>
      <div className="booking-review__policy">
        <img alt="" aria-hidden="true" src={policyIcon} />
        <span>
          <strong>Hủy và hoàn tiền theo chính sách của chúng tôi</strong>
          <small>Mức phí phụ thuộc thời điểm hủy trước giờ khởi hành.</small>
        </span>
        <details className="booking-review__policy-details">
          <summary>Xem chính sách</summary>
          <p>
            Đây là chính sách mô phỏng. Mức hoàn cụ thể phụ thuộc thời điểm hủy
            trước giờ khởi hành.
          </p>
        </details>
      </div>
      <p className="booking-review__policy">
        <img alt="" aria-hidden="true" src={quoteIcon} />
        <span>
          <strong>Giá cuối cùng được xác nhận bởi hệ thống BLUE</strong>
          <small>Báo giá giữ nguyên trong thời gian hiển thị bên phải.</small>
        </span>
      </p>
    </section>
  );
}
export function BookingReview(props: BookingReviewProps): ReactElement {
  return (
    <div
      className={[
        "booking-review",
        props.routeOptions && "booking-review--live",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {props.draft.bookingId && (
        <p role="status">
          Đặt vé đã được xác nhận. Thông tin được khóa; bạn có thể tiếp tục
          thanh toán với đặt vé hiện tại.
        </p>
      )}
      <ReviewJourney {...props} />
      <ReviewPassengers {...props} />
      <ReviewPolicy />
      <p className="booking-review__consent">
        <img alt="" aria-hidden="true" src={verifiedIcon} />
        <span>
          Bằng việc nhấn tiếp tục, bạn xác nhận đã kiểm tra chính xác hành
          trình, hành khách và điểm đón.
          <small>
            Thông tin sẽ được gửi cho nhà xe sau khi thanh toán thành công
          </small>
        </span>
      </p>
    </div>
  );
}
