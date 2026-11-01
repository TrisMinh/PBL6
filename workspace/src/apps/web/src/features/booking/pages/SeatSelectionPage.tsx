import { isMockApi } from "@/shared/api/config";
import { type ReactElement } from "react";
import { Link, useNavigate } from "react-router";

import type { SeatFocus } from "@/features/booking/hooks/useSeatFocus";
import { useSeatFocus } from "@/features/booking/hooks/useSeatFocus";
import type { HoldCountdown } from "@/features/booking/hooks/useHoldCountdown";
import { SeatMap } from "@/features/booking/components/SeatMap/SeatMap";
import { BookingSummary } from "@/features/booking/components/BookingSummary/BookingSummary";
import { BookedSessionState } from "@/features/booking/components/BookedSessionState";
import { BookingLockedFeedback } from "@/features/booking/components/BookingLockedFeedback";
import { SeatConflictDialog } from "@/features/booking/components/SeatConflictDialog/SeatConflictDialog";
import {
  DialogActionLink,
  SeatStateDialog,
} from "@/features/booking/components/SeatConflictDialog/SeatStateDialog";
import { releaseExpiredSeats } from "@/features/booking/hooks/useBookingExpiry";
import { useHoldCountdown } from "@/features/booking/hooks/useHoldCountdown";
import {
  useReplaceSeats,
  type ReplaceSeatsResult,
} from "@/features/booking/hooks/useReplaceSeats";
import { useSeats } from "@/features/booking/hooks/useSeats";
import { bookingResultsPath } from "@/features/booking/lib/bookingRecovery";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import { bookingPassengersPath, ROUTES } from "@/shared/config/routes";
import { formatDateTime } from "@/shared/lib/formatDateTime";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { canContinueBooking } from "@/features/booking/lib/canContinueBooking";

import "./SeatSelectionPage.css";

function BookingSteps({
  layout,
  draft,
}: {
  layout: SeatLayout;
  draft: BookingDraft;
}): ReactElement {
  return (
    <nav aria-label="Tiến trình đặt vé">
      <ol className="seat-selection__steps">
        <li>
          <Link to={bookingResultsPath(layout, draft.passengerCount)}>
            Chuyến đi
          </Link>
        </li>
        <li aria-current="step">Chọn ghế</li>
        <li>Hành khách</li>
        <li>Thanh toán</li>
      </ol>
    </nav>
  );
}
function SeatHeading({
  layout,
  draft,
}: {
  layout: SeatLayout;
  draft: BookingDraft;
}): ReactElement {
  return (
    <header className="seat-selection__heading">
      <BookingSteps layout={layout} draft={draft} />
      <h1>
        {layout.vehicleType === "cabin-22"
          ? "Chọn cabin của bạn"
          : "Chọn ghế của bạn"}
      </h1>
      <div className="seat-selection__trip">
        <strong>
          {layout.trip.origin.province} → {layout.trip.destination.province}
        </strong>
        <span>
          {formatDateTime(layout.trip.departureTime, "dd/MM/yyyy")} ·{" "}
          {formatDateTime(layout.trip.departureTime, "HH:mm")} ·{" "}
          {layout.trip.operator.name}
        </span>
        <span>
          {layout.trip.origin.name} → {layout.trip.destination.name}
        </span>
      </div>
    </header>
  );
}
function MutationFeedback({
  mutation,
  onRetry,
  sessionId,
}: {
  mutation: ReplaceSeatsResult;
  onRetry: () => void;
  sessionId: string;
}): ReactElement | null {
  if (mutation.error?.code === "BOOKING_LOCKED")
    return <BookingLockedFeedback sessionId={sessionId} />;
  if (mutation.limitReached)
    return (
      <p className="seat-selection__feedback" role="alert">
        Bạn chỉ có thể chọn tối đa 6 ghế mỗi phiên.
      </p>
    );
  if (
    !mutation.error ||
    mutation.error.code === "SEAT_CONFLICT" ||
    mutation.error.code === "HOLD_EXPIRED" ||
    mutation.error.code === "ABORTED"
  )
    return null;
  return (
    <div className="seat-selection__feedback" role="alert">
      <p>
        Chưa thể cập nhật ghế. Lựa chọn trước đó được giữ nguyên. Hãy tải lại sơ
        đồ và chọn lại.
      </p>
      <Button type="button" variant="secondary" onClick={onRetry}>
        Tải lại sơ đồ
      </Button>
    </div>
  );
}
interface SeatBookingProps {
  draft: BookingDraft;
  layout: SeatLayout;
  isFetching: boolean;
  onRefetch: () => void;
  countdown: HoldCountdown;
}
function BookingConflict({
  draft,
  layout,
  mutation,
  onRefetch,
  onFocusReturn,
}: Pick<SeatBookingProps, "draft" | "layout" | "onRefetch"> & {
  mutation: ReplaceSeatsResult;
  onFocusReturn: () => void;
}): ReactElement {
  const codes = layout.items
    .filter((seat) => mutation.error?.conflictingSeatIds.includes(seat.id))
    .map((seat) => seat.code);
  return (
    <SeatConflictDialog
      open={mutation.error?.code === "SEAT_CONFLICT"}
      codes={codes}
      resultsPath={bookingResultsPath(layout, draft.passengerCount)}
      onClose={mutation.dismissError}
      onChooseAgain={() => {
        onRefetch();
        mutation.dismissError();
      }}
      onFocusReturn={onFocusReturn}
    />
  );
}
interface SeatBodyProps extends SeatBookingProps {
  mutation: ReplaceSeatsResult;
  focus: SeatFocus;
  onToggle: (id: string) => void;
  onContinue: () => void;
}
function SeatBookingBody(props: SeatBodyProps): ReactElement {
  return (
    <>
      <MutationFeedback
        mutation={props.mutation}
        sessionId={props.draft.sessionId}
        onRetry={() => {
          props.mutation.dismissError();
          props.onRefetch();
        }}
      />
      <div className="seat-selection__body">
        <div
          className="seat-selection__map"
          ref={(node) => props.focus.bindRegion(node)}
        >
          <SeatMap
            layout={props.layout}
            selectedSeatIds={props.draft.selectedSeatIds}
            isPending={props.isFetching}
            onToggle={props.onToggle}
          />
        </div>
        <BookingSummary
          draft={props.draft}
          layout={props.layout}
          countdown={props.countdown}
          isPending={props.isFetching}
          onContinue={props.onContinue}
        />
      </div>
    </>
  );
}
function SeatBooking(props: SeatBookingProps): ReactElement {
  const { draft, layout, isFetching, countdown } = props;
  const mutation = useReplaceSeats(draft, layout);
  const navigate = useNavigate();
  const focus = useSeatFocus();
  const expired =
    countdown.isExpired || mutation.error?.code === "HOLD_EXPIRED";
  const resultsPath = bookingResultsPath(layout, draft.passengerCount);
  const recoverExpired = (): void => {
    releaseExpiredSeats(draft.tripId);
    useBookingDraftStore.getState().clearDraft();
    void navigate(resultsPath);
  };
  const pending =
    mutation.isPending ||
    isFetching ||
    mutation.error?.code === "BOOKING_LOCKED" ||
    expired;
  const toggle = (id: string): void => {
    focus.remember();
    mutation.toggle(id);
  };
  const continueBooking = (): void => {
    if (canContinueBooking(draft, layout, countdown, pending))
      void navigate(bookingPassengersPath(draft.sessionId));
  };
  return (
    <>
      <SeatHeading layout={layout} draft={draft} />
      <SeatBookingBody
        {...props}
        isFetching={pending}
        mutation={mutation}
        focus={focus}
        onToggle={toggle}
        onContinue={continueBooking}
      />
      <BookingConflict
        {...props}
        mutation={mutation}
        onFocusReturn={focus.restore}
      />
      <SeatStateDialog
        open={mutation.limitReached}
        variant="limit"
        eyebrow="GIỚI HẠN ĐẶT CHỖ"
        title="Bạn đã chọn đủ 6 chỗ"
        description="Mỗi lượt đặt vé hỗ trợ tối đa 6 vị trí. Bạn có thể bỏ chọn một chỗ trước khi chọn vị trí khác."
        statusLead="6/6 chỗ đã chọn"
        statusDetail="Đã đạt giới hạn"
        onClose={mutation.dismissError}
        onFocusReturn={focus.restore}
        secondary={
          <Button
            type="button"
            variant="secondary"
            onClick={mutation.dismissError}
          >
            Đóng
          </Button>
        }
        primary={
          <Button type="button" onClick={mutation.dismissError}>
            Xem chỗ đã chọn
          </Button>
        }
      />
      <SeatStateDialog
        open={expired}
        variant="expired"
        eyebrow="PHIÊN GIỮ GHẾ"
        title="Phiên giữ ghế đã hết hạn"
        description="Thời gian giữ chỗ đã kết thúc. Ghế đã được trả về trạng thái trống để hành khách khác lựa chọn."
        statusLead="Ghế đã được trả về trạng thái trống"
        statusDetail="Giờ và tình trạng chỗ sẽ được làm mới"
        onClose={recoverExpired}
        secondary={
          <DialogActionLink
            to={resultsPath}
            onClick={() => {
              releaseExpiredSeats(draft.tripId);
              useBookingDraftStore.getState().clearDraft();
            }}
          >
            Quay lại danh sách
          </DialogActionLink>
        }
        primary={
          <DialogActionLink
            to={resultsPath}
            variant="primary"
            onClick={() => {
              releaseExpiredSeats(draft.tripId);
              useBookingDraftStore.getState().clearDraft();
            }}
          >
            Kiểm tra lại chuyến
          </DialogActionLink>
        }
      />
    </>
  );
}
function DraftSeats({ draft }: { draft: BookingDraft }): ReactElement {
  const query = useSeats(draft.tripId);
  const countdown = useHoldCountdown(draft.expiresAt);
  if (query.isPending)
    return (
      <section>
        <h1>Chọn ghế</h1>
        <p role="status">Đang tải sơ đồ ghế…</p>
      </section>
    );
  if (query.isError)
    return (
      <PageState
        title="Không thể tải sơ đồ ghế"
        description="Kiểm tra kết nối và thử tải lại sơ đồ để chọn ghế."
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
  return (
    <SeatBooking
      draft={draft}
      countdown={countdown}
      layout={query.data}
      isFetching={query.isFetching}
      onRefetch={() => void query.refetch()}
    />
  );
}
export function SeatSelectionPage(): ReactElement {
  const draft = useBookingDraftStore((state) => state.draft);
  if (draft?.bookingId)
    return <BookedSessionState sessionId={draft.sessionId} />;
  return (
    <div className="seat-selection">
      {!isMockApi && (
        <p role="status">
          Ghế mới được chọn trong bản nháp. Hệ thống sẽ kiểm tra và giữ ghế khi
          bạn xác nhận đặt vé. Thời gian đếm ngược là thời hạn bản nháp.
        </p>
      )}
      {draft ? (
        <DraftSeats draft={draft} />
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
