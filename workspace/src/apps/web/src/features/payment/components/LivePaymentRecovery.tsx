import { livePaymentPath } from "@/features/payment/checkoutAction";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import type { ReactElement } from "react";
import { apiJson } from "@/shared/api/client";
import { bookingSchema } from "@/shared/api/contracts";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import { useHoldCountdown } from "@/features/booking/hooks/useHoldCountdown";
import { Button } from "@/shared/ui/Button/Button";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import shield from "@/assets/payment/failure-shield.svg";
import "../pages/PaymentPage.css";
import "./PaymentResultCard.css";
import "./LivePaymentRecovery.css";

interface Props {
  bookingId: string;
  payment: { id: string; status: string; amount: number };
  checking: boolean;
  checkedAt: number;
  notice?: string;
  onRecheck: () => Promise<unknown>;
}
const clock = (value: string | number): string =>
  new Date(value).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
export function LivePaymentRecovery({
  bookingId,
  payment,
  checking,
  checkedAt,
  notice,
  onRecheck,
}: Props): ReactElement {
  const query = useQuery({
    queryKey: liveQueryKey("payment-recovery", bookingId),
    queryFn: async ({ signal }) => {
      const booking = await apiJson(
        `/api/v1/bookings/${bookingId}`,
        bookingSchema,
        { signal },
      );
      const trip = await getBackendTrip(booking.tripId, signal);
      return { booking, trip };
    },
    retry: false,
  });
  const countdown = useHoldCountdown(query.data?.booking.expiresAt ?? "");
  const canRetry =
    query.data?.booking.status === "PENDING_PAYMENT" &&
    !countdown.isExpired &&
    countdown.remainingSeconds > 0;
  const cancelled = payment.status === "CANCELLED";
  const title = cancelled ? "Thanh toán đã hủy" : "Thanh toán chưa thành công";
  return (
    <section className="payment-page live-payment-recovery">
      <header className="payment-page__heading">
        <nav aria-label="Tiến trình đặt vé">
          Chuyến đi → Chọn ghế → Hành khách → Thanh toán → Không thành công
        </nav>
        <h1>{title}</h1>
        {notice && <p role="alert">{notice}</p>}
      </header>
      {query.isPending ? (
        <p role="status">Đang tải thông tin đơn…</p>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <article className="payment-result">
          <header className="payment-result__journey">
            <div className="payment-result__reference">
              <strong className="live-payment-recovery__brand">BLUE</strong>
              <span className="live-payment-recovery__status">
                {cancelled ? "GIAO DỊCH ĐÃ HỦY" : "GIAO DỊCH CHƯA HOÀN TẤT"}
              </span>
              <span className="payment-result__booking-code">
                MÃ {query.data.booking.code}
              </span>
            </div>
            <h2>
              {query.data.trip.origin} → {query.data.trip.destination}
            </h2>
            <p>
              {new Date(query.data.trip.departureAt).toLocaleDateString(
                "vi-VN",
                {
                  timeZone: "Asia/Ho_Chi_Minh",
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                },
              )}{" "}
              · Khởi hành {clock(query.data.trip.departureAt).slice(0, 5)}
            </p>
          </header>
          <div className="payment-result__body">
            <div>
              <div className="live-payment-recovery__warning">
                <span aria-hidden="true">!</span>
                <div>
                  <h2>
                    {cancelled
                      ? "Giao dịch đã hủy"
                      : "Chưa ghi nhận thanh toán"}
                  </h2>
                  <p>
                    {cancelled
                      ? "Giao dịch được ghi nhận ở trạng thái đã hủy."
                      : "Ngân hàng hoặc cổng thanh toán chưa xác nhận giao dịch."}
                    <br />
                    {canRetry
                      ? "Ghế của bạn vẫn được giữ trong thời gian bên dưới."
                      : "Đơn không còn trong thời gian thanh toán. Vui lòng kiểm tra lại hành trình."}
                  </p>
                </div>
              </div>
              <dl className="live-payment-recovery__details">
                <div>
                  <dt>GIỮ GHẾ ĐẾN</dt>
                  <dd>
                    {canRetry
                      ? clock(query.data.booking.expiresAt).slice(0, 5)
                      : "Đã hết hạn"}
                  </dd>
                </div>
                <div>
                  <dt>KIỂM TRA LẦN CUỐI</dt>
                  <dd>{clock(checkedAt)}</dd>
                </div>
                <div>
                  <dt>SỐ TIỀN</dt>
                  <dd>{formatCurrencyVnd(payment.amount)}</dd>
                </div>
              </dl>
              <div className="live-payment-recovery__safety">
                <img src={shield} alt="" />
                <p>
                  Nếu tài khoản đã bị trừ tiền, đừng thanh toán lại.
                  <br />
                  Hãy kiểm tra giao dịch trước để tránh thanh toán hai lần.
                </p>
              </div>
              <p className="live-payment-recovery__note">
                Đơn hết hạn không thể tiếp tục thanh toán. Hệ thống không tự
                động trừ tiền.
              </p>
            </div>
            <aside className="live-payment-recovery__actions">
              <h2>Chọn cách xử lý</h2>
              <p>
                Ưu tiên kiểm tra trạng thái giao dịch.
                <br />
                {canRetry
                  ? "Bạn có thể thanh toán lại nếu chưa bị trừ tiền."
                  : "Tìm chuyến khác khi đơn đã hết hạn giữ ghế."}
              </p>
              <Button
                isLoading={checking || query.isFetching}
                onClick={() => void Promise.all([onRecheck(), query.refetch()])}
              >
                Kiểm tra giao dịch
              </Button>
              <Link
                className="live-payment-recovery__alternative"
                to={canRetry ? livePaymentPath(bookingId) : "/"}
              >
                {canRetry ? "Quay lại thanh toán" : "Tìm chuyến khác"}
              </Link>
              <Link
                className="live-payment-recovery__back"
                to="/account/tickets"
              >
                ← Về hành trình của tôi
              </Link>
              <small>Cần hỗ trợ? Cung cấp mã {payment.id}</small>
            </aside>
          </div>
        </article>
      )}
    </section>
  );
}
