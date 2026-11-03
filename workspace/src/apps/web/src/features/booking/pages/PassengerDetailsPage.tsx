import { isTripUnavailable } from "@/features/trips/lib/isTripUnavailable";
import { TripUnavailableState } from "@/features/booking/components/TripUnavailableState";
import { useId, type ReactElement } from "react";
import { Link } from "react-router";

import { BookingSummary } from "@/features/booking/components/BookingSummary/BookingSummary";
import { BookedSessionState } from "@/features/booking/components/BookedSessionState";
import { BookingLockedFeedback } from "@/features/booking/components/BookingLockedFeedback";
import {
  PassengerForm,
  type PassengerSeat,
} from "@/features/booking/components/PassengerForm/PassengerForm";
import { useBookingExpiry } from "@/features/booking/hooks/useBookingExpiry";
import {
  useDraftCountdown,
  type HoldCountdown,
} from "@/features/booking/hooks/useDraftCountdown";
import {
  useReplacePassengers,
  type ReplacePassengersResult,
} from "@/features/booking/hooks/useReplacePassengers";
import { useSeats } from "@/features/booking/hooks/useSeats";
import { bookingResultsPath } from "@/features/booking/lib/bookingRecovery";
import {
  getPassengerDefaults,
  getSelectedPassengerSeats,
} from "@/features/booking/lib/passengerDraft";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import { bookingSeatsPath, ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";

import "./PassengerDetailsPage.css";

interface PassengerBookingProps {
  draft: BookingDraft;
  layout: SeatLayout;
  countdown: HoldCountdown;
  isFetching: boolean;
  onRefetch: () => void;
  hasQueryError: boolean;
}
const BOOKING_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function PassengerHeading({
  draft,
  layout,
}: Pick<PassengerBookingProps, "draft" | "layout">): ReactElement {
  return (
    <header className="passenger-details__heading">
      <nav aria-label="Tiến trình đặt vé">
        <ol className="passenger-details__steps">
          <li>
            <Link to={bookingResultsPath(layout, draft.passengerCount)}>
              Chuyến đi
            </Link>
          </li>
          <li>
            <Link to={bookingSeatsPath(draft.sessionId)}>Chọn ghế</Link>
          </li>
          <li aria-current="step">Hành khách</li>
          <li>Thanh toán</li>
        </ol>
      </nav>
      <h1>Thông tin hành khách</h1>
      <p>Nhập thông tin hành khách và chọn một điểm đón chung cho cả đơn.</p>
    </header>
  );
}
function QueryFeedback({ onRefetch }: { onRefetch: () => void }): ReactElement {
  return (
    <div className="passenger-details__feedback" role="alert">
      <p>
        Chưa thể kiểm tra lại chuyến đi. Thông tin bạn đang nhập được giữ
        nguyên.
      </p>
      <Button type="button" variant="secondary" onClick={onRefetch}>
        Thử lại
      </Button>
    </div>
  );
}
function SaveFeedback({
  error,
  sessionId,
}: Pick<ReplacePassengersResult, "error"> & {
  sessionId: string;
}): ReactElement | null {
  if (error?.code === "BOOKING_LOCKED")
    return <BookingLockedFeedback sessionId={sessionId} />;
  if (!error || ["HOLD_EXPIRED", "ABORTED"].includes(error.code)) return null;
  return (
    <p className="passenger-details__feedback" role="alert">
      Chưa thể lưu thông tin. Dữ liệu bạn nhập được giữ nguyên. Vui lòng kiểm
      tra và xác nhận lại.
    </p>
  );
}
function isPassengerBlocked(
  props: PassengerBookingProps,
  mutation: ReplacePassengersResult,
): boolean {
  return (
    props.isFetching ||
    mutation.isPending ||
    props.hasQueryError ||
    mutation.error?.code === "BOOKING_LOCKED"
  );
}
function PassengerBooking(
  props: PassengerBookingProps & { seats: PassengerSeat[] },
): ReactElement {
  const formId = useId();
  const mutation = useReplacePassengers(props.draft);
  useBookingExpiry(
    props.draft,
    props.layout,
    mutation.error?.code === "HOLD_EXPIRED",
  );
  const pending = isPassengerBlocked(props, mutation);
  const checkInAt = new Date(
    new Date(props.layout.trip.departureTime).getTime() - 20 * 60 * 1000,
  ).toISOString();
  return (
    <>
      <PassengerHeading {...props} />
      {props.hasQueryError && <QueryFeedback onRefetch={props.onRefetch} />}
      <SaveFeedback error={mutation.error} sessionId={props.draft.sessionId} />
      <div className="passenger-details__body">
        <PassengerForm
          seats={props.seats}
          initialValues={getPassengerDefaults(props.draft, props.seats)}
          pickup={`${props.layout.trip.originStopName} · Có mặt ${BOOKING_TIME.format(new Date(checkInAt))}`}
          onSubmit={mutation.submit}
          isPending={pending}
          formId={formId}
        />
        <BookingSummary
          draft={props.draft}
          layout={props.layout}
          countdown={props.countdown}
          isPending={pending}
          isActionPending={mutation.isPending || props.isFetching}
          formId={formId}
          actionLabel="Xác nhận thông tin"
          hint="BLUE - Lựa chọn hàng nhì để đặt vé xe · Mọi phản ánh xin liên hệ blue@info.example.com"
          variant="passenger"
        />
      </div>
    </>
  );
}
function LoadedPassengers(props: PassengerBookingProps): ReactElement {
  const seats = getSelectedPassengerSeats(props.draft, props.layout);
  if (!seats)
    return (
      <PageState
        title="Vui lòng chọn lại ghế"
        description="Lựa chọn ghế chưa khớp với chuyến đi. Hãy kiểm tra lại trước khi nhập thông tin."
        action={
          <Link to={bookingSeatsPath(props.draft.sessionId)}>
            Quay lại chọn ghế
          </Link>
        }
      />
    );
  return (
    <PassengerBooking
      key={`${props.draft.sessionId}:${props.draft.selectedSeatIds.join(",")}`}
      {...props}
      seats={seats}
    />
  );
}
function DraftPassengers({ draft }: { draft: BookingDraft }): ReactElement {
  const query = useSeats(draft.tripId);
  const countdown = useDraftCountdown(draft.expiresAt);
  useBookingExpiry(draft, query.data, countdown.isExpired);
  if (query.data && isTripUnavailable(query.data.trip))
    return <TripUnavailableState />;
  if (query.data)
    return (
      <LoadedPassengers
        draft={draft}
        layout={query.data}
        countdown={countdown}
        isFetching={query.isFetching}
        hasQueryError={query.isError}
        onRefetch={() => void query.refetch()}
      />
    );
  if (query.isPending)
    return (
      <section>
        <h1>Thông tin hành khách</h1>
        <p role="status">Đang tải thông tin chuyến đi…</p>
      </section>
    );
  return (
    <PageState
      title="Không thể tải thông tin chuyến đi"
      description="Kiểm tra kết nối và thử lại để nhập thông tin hành khách."
      action={
        <Button
          type="button"
          isLoading={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Thử lại
        </Button>
      }
    />
  );
}
export function PassengerDetailsPage(): ReactElement {
  const draft = useBookingDraftStore((state) => state.draft);
  if (draft?.bookingId)
    return <BookedSessionState sessionId={draft.sessionId} />;
  return (
    <div className="passenger-details">
      {draft ? (
        <DraftPassengers draft={draft} />
      ) : (
        <PageState
          title="Phiên giữ chỗ đã hết hạn"
          description="Vui lòng tìm lại chuyến và chọn ghế mới."
          action={<Link to={ROUTES.home}>Tìm lại chuyến</Link>}
        />
      )}
    </div>
  );
}
