import {
  LiveBookingOptions,
  type LiveReviewContent,
} from "../components/LiveBookingOptions";
import { isMockApi } from "@/shared/api/config";
import { useState, type ReactElement } from "react";
import { Link } from "react-router";

import { BookingReview } from "@/features/booking/components/BookingReview/BookingReview";
import { BookingSummary } from "@/features/booking/components/BookingSummary/BookingSummary";
import { useBookingExpiry } from "@/features/booking/hooks/useBookingExpiry";
import {
  useHoldCountdown,
  type HoldCountdown,
} from "@/features/booking/hooks/useHoldCountdown";
import { useSeats } from "@/features/booking/hooks/useSeats";
import { useCreateBooking } from "@/features/booking/hooks/useCreateBooking";
import { canReviewBooking } from "@/features/booking/lib/bookingReview";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import {
  bookingPassengersPath,
  bookingSeatsPath,
  ROUTES,
} from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";

import "./BookingReviewPage.css";

interface ReviewProps {
  draft: BookingDraft;
  layout: SeatLayout;
  countdown: HoldCountdown;
  isPending: boolean;
}
function ReviewContent(props: ReviewProps): ReactElement {
  if (!canReviewBooking(props.draft, props.layout))
    return (
      <PageState
        title="Vui lòng kiểm tra thông tin đặt vé"
        description="Chọn đủ ghế và nhập thông tin hành khách hợp lệ trước khi tiếp tục."
        action={
          <Link
            to={
              props.draft.bookingId
                ? ROUTES.home
                : bookingPassengersPath(props.draft.sessionId)
            }
          >
            {props.draft.bookingId ? "Tìm lại chuyến" : "Chỉnh sửa hành khách"}
          </Link>
        }
      />
    );
  return <ReadyReview {...props} />;
}
function ReviewHeading({ draft }: Pick<ReviewProps, "draft">): ReactElement {
  return (
    <header className="booking-review-page__heading">
      <nav aria-label="Tiến trình đặt vé">
        <ol className="booking-review-page__steps">
          <li>
            {draft.bookingId ? (
              "Chọn ghế"
            ) : (
              <Link to={bookingSeatsPath(draft.sessionId)}>Chọn ghế</Link>
            )}
          </li>
          <li>
            {draft.bookingId ? (
              "Hành khách"
            ) : (
              <Link to={bookingPassengersPath(draft.sessionId)}>
                Hành khách
              </Link>
            )}
          </li>
          <li aria-current="step">Kiểm tra đặt vé</li>
          <li>Thanh toán</li>
        </ol>
      </nav>
      <h1>Kiểm tra trước khi thanh toán</h1>
      <p>
        Xác nhận hành trình, hành khách và chi phí trước khi chuyển sang thanh
        toán.
      </p>
    </header>
  );
}
function ReadyReview(props: ReviewProps): ReactElement {
  const [releasePending, setReleasePending] = useState(false);
  const mutation = useCreateBooking(props.draft);
  useBookingExpiry(
    props.draft,
    props.layout,
    mutation.error?.code === "HOLD_EXPIRED",
  );
  const pending = props.isPending || mutation.isPending || releasePending;
  const renderContent = (content?: LiveReviewContent): ReactElement => (
    <div className="booking-review-page__body">
      <BookingReview
        draft={props.draft}
        layout={content?.layout ?? props.layout}
        routeOptions={content?.routeOptions}
      />
      <BookingSummary
        {...props}
        layout={content?.layout ?? props.layout}
        isPending={pending}
        isActionPending={mutation.isPending}
        onContinue={mutation.create}
        actionLabel={
          content?.payLater ? "Xác nhận đặt vé" : "Tiếp tục thanh toán"
        }
        hint="Vui lòng xác nhận thông tin chính xác trước khi tiếp tục"
        variant="review"
        backHref={bookingPassengersPath(props.draft.sessionId)}
        paymentOptions={content?.paymentOptions}
        secondaryAction={content?.secondaryAction}
      />
    </div>
  );
  return (
    <>
      <ReviewHeading draft={props.draft} />
      {mutation.error &&
        !["HOLD_EXPIRED", "ABORTED"].includes(mutation.error.code) && (
          <p className="booking-review-page__feedback" role="alert">
            Chưa thể xác nhận đặt vé. Vui lòng kiểm tra thông tin và thử lại.
          </p>
        )}
      {isMockApi ? (
        renderContent()
      ) : (
        <LiveBookingOptions
          draft={props.draft}
          layout={props.layout}
          pending={pending}
          onReleasePending={setReleasePending}
        >
          {renderContent}
        </LiveBookingOptions>
      )}
    </>
  );
}

function DraftReview({ draft }: { draft: BookingDraft }): ReactElement {
  const query = useSeats(draft.tripId);
  const countdown = useHoldCountdown(draft.expiresAt);
  useBookingExpiry(draft, query.data, countdown.isExpired);
  if (query.isPending)
    return (
      <section>
        <h1>Kiểm tra đặt vé</h1>
        <p role="status">Đang tải thông tin đặt vé…</p>
      </section>
    );
  if (query.isError)
    return (
      <PageState
        title="Không thể tải thông tin đặt vé"
        description="Kiểm tra kết nối và thử lại."
        action={
          <Button type="button" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        }
      />
    );
  return (
    <ReviewContent
      draft={draft}
      layout={query.data}
      countdown={countdown}
      isPending={query.isFetching}
    />
  );
}
export function BookingReviewPage(): ReactElement {
  const draft = useBookingDraftStore((state) => state.draft);
  return (
    <div className="booking-review-page">
      {draft ? (
        <DraftReview draft={draft} />
      ) : (
        <PageState
          title="Phiên giữ chỗ đã hết hạn"
          description="Vui lòng tìm chuyến và bắt đầu đặt vé mới."
          action={<Link to={ROUTES.home}>Tìm lại chuyến</Link>}
        />
      )}
    </div>
  );
}
