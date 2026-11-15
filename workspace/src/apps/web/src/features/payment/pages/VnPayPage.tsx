import { Toast } from "@/shared/ui/Toast/Toast";
import type { ReactElement } from "react";
import { Link } from "react-router";

import { BookingSummary } from "@/features/booking/components/BookingSummary/BookingSummary";
import { useSeats } from "@/features/booking/hooks/useSeats";
import {
  useHoldCountdown,
  type HoldCountdown,
} from "@/features/booking/hooks/useHoldCountdown";
import { useBookingExpiry } from "@/features/booking/hooks/useBookingExpiry";
import { canReviewBooking } from "@/features/booking/lib/bookingReview";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import { PaymentCheckout } from "@/features/payment/components/PaymentCheckout";
import { useCreatePayment } from "@/features/payment/hooks/useCreatePayment";
import {
  bookingReviewPath,
  paymentReturnPath,
  ROUTES,
} from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";

import "./PaymentPage.css";

interface ReadyProps {
  draft: BookingDraft;
  layout: SeatLayout;
  countdown: HoldCountdown;
  isFetching: boolean;
}
function actionLabel(draft: BookingDraft): string {
  return draft.paymentAttempt?.transactionId
    ? "Kiểm tra giao dịch"
    : draft.paymentAttempt
      ? "Thử lại yêu cầu thanh toán"
      : "Tiếp tục đến VNPay";
}
function PaymentHeading({ draft }: { draft: BookingDraft }): ReactElement {
  return (
    <header className="payment-page__heading">
      <nav aria-label="Tiến trình đặt vé">
        <Link to={bookingReviewPath(draft.sessionId)}>
          Quay lại kiểm tra thông tin
        </Link>
        <span aria-current="step">Thanh toán</span>
      </nav>
      <h1>Thanh toán đơn đặt vé</h1>
      <p>Chọn phương thức và theo dõi trạng thái thanh toán của đơn đặt vé.</p>
    </header>
  );
}
function ReadyCheckout(props: ReadyProps): ReactElement {
  const mutation = useCreatePayment(props.draft);
  useBookingExpiry(
    props.draft,
    props.layout,
    mutation.error?.code === "HOLD_EXPIRED",
  );
  const isPending = props.isFetching || mutation.isPending;
  return (
    <>
      <PaymentHeading draft={props.draft} />
      {mutation.error &&
        !["ABORTED", "HOLD_EXPIRED"].includes(mutation.error.code) && (
          <Toast
            tone="error"
            message="Chưa thể tạo giao dịch. Đặt vé được giữ nguyên. Hãy kiểm tra và thử lại yêu cầu hiện tại."
          />
        )}
      <div className="payment-page__checkout">
        <PaymentCheckout
          {...props}
          isPending={isPending}
          onPay={mutation.pay}
        />
        <BookingSummary
          {...props}
          isPending={isPending}
          isActionPending={mutation.isPending}
          onContinue={() => {
            if (props.draft.paymentAttempt) {
              mutation.pay(props.draft.paymentAttempt.scenario ?? "success");
            }
          }}
          primaryAction={
            !props.draft.paymentAttempt ? (
              <div className="mock-gateway__waiting" role="status">
                <span />
                Chờ xác nhận thanh toán
              </div>
            ) : undefined
          }
          actionLabel={actionLabel(props.draft)}
          hint=""
          variant="payment"
          backHref={bookingReviewPath(props.draft.sessionId)}
        />
      </div>
    </>
  );
}
function DraftCheckout({ draft }: { draft: BookingDraft }): ReactElement {
  const query = useSeats(draft.tripId),
    countdown = useHoldCountdown(draft.expiresAt);
  useBookingExpiry(draft, query.data, countdown.isExpired);
  if (query.isPending)
    return (
      <section>
        <h1>Thanh toán đơn đặt vé</h1>
        <p role="status">Đang tải thông tin thanh toán…</p>
      </section>
    );
  if (query.isError)
    return (
      <PageState
        title="Không thể tải đặt vé"
        description="Kiểm tra kết nối và thử lại."
        action={
          <Button type="button" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        }
      />
    );
  if (!canReviewBooking(draft, query.data))
    return (
      <PageState
        title="Vui lòng kiểm tra đặt vé"
        description="Thông tin đặt vé chưa khớp. Hãy tìm lại chuyến."
        action={<Link to={ROUTES.home}>Tìm lại chuyến</Link>}
      />
    );
  return (
    <ReadyCheckout
      draft={draft}
      layout={query.data}
      countdown={countdown}
      isFetching={query.isFetching}
    />
  );
}
export function VnPayPage(): ReactElement {
  const draft = useBookingDraftStore((s) => s.draft);
  if (
    draft?.bookingId &&
    draft.paymentAttempt?.transactionId &&
    draft.paymentAttempt.resultId
  )
    return (
      <div className="payment-page">
        <PageState
          title="Kiểm tra giao dịch hiện tại"
          description="Giao dịch đã được tạo. Kiểm tra kết quả hiện tại trước khi thực hiện lại."
          action={
            <Link
              to={paymentReturnPath(
                draft.paymentAttempt.transactionId,
                draft.paymentAttempt.resultId,
              )}
            >
              Kiểm tra giao dịch
            </Link>
          }
        />
      </div>
    );
  return (
    <div className="payment-page payment-page--checkout">
      {draft?.bookingId ? (
        <DraftCheckout draft={draft} />
      ) : (
        <PageState
          title="Không tìm thấy đặt vé còn hiệu lực"
          description="Vui lòng tìm lại chuyến để bắt đầu."
          action={<Link to={ROUTES.home}>Tìm lại chuyến</Link>}
        />
      )}
    </div>
  );
}
