import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { Toast } from "@/shared/ui/Toast/Toast";
import { isMockApi } from "@/shared/api/config";
import { isTripUnavailable } from "@/features/trips/lib/isTripUnavailable";
import { TripUnavailableState } from "@/features/booking/components/TripUnavailableState";
import { useEffect, type ReactElement } from "react";
import {
  cancelSeatDraft,
  hasLiveSeatSession,
  keyFor,
} from "@/features/booking/repositories/backendBookingRepository";
import { useMutation } from "@tanstack/react-query";
import { CancelSeatSessionButton } from "../components/CancelSeatSessionButton";
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
import { useDraftCountdown } from "@/features/booking/hooks/useDraftCountdown";
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
import { VerifyBookingPhone } from "@/features/booking/components/VerifyBookingPhone";

import "./SeatSelectionPage.css";

const seatLimit = isMockApi ? 6 : 4;

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
          {layout.trip.origin.displayName} →{" "}
          {layout.trip.destination.displayName}
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
  tripId,
}: {
  mutation: ReplaceSeatsResult;
  onRetry: () => void;
  sessionId: string;
  tripId: string;
}): ReactElement | null {
  if (mutation.error?.code === "BOOKING_LOCKED")
    return <BookingLockedFeedback sessionId={sessionId} />;
  if (mutation.error?.code === "PHONE_VERIFICATION_REQUIRED")
    return <VerifyBookingPhone onVerified={onRetry} />;
  if (mutation.error?.code === "ACTIVE_SEAT_HOLD")
    return (
      <div className="seat-selection__feedback" role="alert">
        <p>{mutation.error.message}</p>
        <Link to={`/trips/${encodeURIComponent(tripId)}/seats`}>
          Tiếp tục lượt giữ ghế
        </Link>
      </div>
    );
  if (
    mutation.error?.code === "SEAT_HOLD_COOLDOWN" ||
    mutation.error?.code === "SEAT_HOLD_LIMIT"
  )
    return <Toast tone="error" message={mutation.error.message} />;
  if (mutation.limitReached)
    return (
      <Toast
        tone="error"
        message={`Bạn chỉ có thể giữ tối đa ${seatLimit} ghế trên một chuyến.`}
      />
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
  hasLiveHold: boolean;
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
  cancelAction?: ReactElement;
}
function SeatBookingBody(props: SeatBodyProps): ReactElement {
  return (
    <>
      <MutationFeedback
        mutation={props.mutation}
        sessionId={props.draft.sessionId}
        tripId={props.draft.tripId}
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
          secondaryAction={props.cancelAction}
          actionLabel={
            !isMockApi && props.draft.selectedSeatIds.length > 0
              ? "Tiếp tục đặt vé"
              : "Tiếp tục"
          }
          hint={
            props.draft.selectedSeatIds.length > 0
              ? `Đã chọn ${props.draft.selectedSeatIds.length} ghế cho ${props.draft.passengerCount} hành khách. Tối đa ${seatLimit} ghế.`
              : `Chọn ít nhất 1 ghế để tiếp tục. Tối đa ${seatLimit} ghế.`
          }
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
  const cancellation = useMutation({
    mutationFn: () => cancelSeatDraft(draft.sessionId),
    onSuccess: () => {
      if (useBookingDraftStore.getState().draft?.sessionId !== draft.sessionId)
        return;
      useBookingDraftStore.getState().clearDraft();
      void navigate(resultsPath, { replace: true });
    },
    retry: false,
  });
  const recoverExpired = (): void => {
    releaseExpiredSeats(draft.tripId);
    useBookingDraftStore.getState().clearDraft();
    void navigate(resultsPath);
  };
  const pending =
    mutation.isPending ||
    cancellation.isPending ||
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
  if (mutation.error?.code === "TRIP_NOT_SELLABLE")
    return <TripUnavailableState />;
  return (
    <>
      <SeatHeading layout={layout} draft={draft} />
      {cancellation.isError && (
        <Toast
          tone="error"
          message="Chưa thể hủy phiên đặt ghế. Vui lòng thử lại."
        />
      )}
      <SeatBookingBody
        {...props}
        isFetching={pending}
        mutation={mutation}
        focus={focus}
        onToggle={toggle}
        onContinue={continueBooking}
        cancelAction={
          props.hasLiveHold ? (
            <CancelSeatSessionButton
              disabled={pending}
              pending={cancellation.isPending}
              onConfirm={() => cancellation.mutate()}
            />
          ) : undefined
        }
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
        title={`Bạn đã chọn đủ ${seatLimit} chỗ`}
        description={`Bạn có thể giữ tối đa ${seatLimit} ghế trên chuyến này. Bỏ chọn một ghế để chọn ghế khác.`}
        statusLead={`${seatLimit}/${seatLimit} chỗ đã chọn`}
        statusDetail="Đã đạt giới hạn"
        onClose={mutation.dismissError}
        onFocusReturn={focus.restore}
        secondary={
          isMockApi ? (
            <Button
              type="button"
              variant="secondary"
              onClick={mutation.dismissError}
            >
              Đóng
            </Button>
          ) : (
            <DialogActionLink to="/support">Hỗ trợ đặt đoàn</DialogActionLink>
          )
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
  const hasLiveHold = !isMockApi && hasLiveSeatSession(draft.sessionId);
  const countdown = useDraftCountdown(draft.expiresAt, hasLiveHold);
  useEffect(() => {
    if (isMockApi || !query.data || query.isFetching || draft.bookingId) return;
    const metadata = JSON.parse(
      sessionStorage.getItem(keyFor(draft.sessionId)) ?? "{}",
    );
    // An unresolved request may own a real hold; never discard that ownership.
    if (metadata.attempt || metadata.holdToken || metadata.bookingId) return;
    const selectedSeatIds = draft.selectedSeatIds.filter((id) =>
      query.data.items.some(
        (seat) => seat.id === id && seat.status === "available",
      ),
    );
    if (
      selectedSeatIds.length === draft.selectedSeatIds.length ||
      useBookingDraftStore.getState().draft !== draft
    )
      return;
    useBookingDraftStore.getState().setDraft({
      ...draft,
      selectedSeatIds,
      passengers: draft.passengers.filter((passenger) =>
        selectedSeatIds.includes(passenger.seatId),
      ),
      totalVnd: query.data.trip.fareVnd * selectedSeatIds.length,
      bookingAttemptKey: draft.bookingAttemptKey
        ? crypto.randomUUID()
        : undefined,
    });
  }, [draft, query.data, query.isFetching]);
  if (query.isPending)
    return (
      <section>
        <h1>Chọn ghế</h1>
        <BrandLoading compact title="Đang tải sơ đồ ghế…" />
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
  if (isTripUnavailable(query.data.trip)) return <TripUnavailableState />;
  return (
    <SeatBooking
      hasLiveHold={hasLiveHold}
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
          bạn xác nhận đặt vé.
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
