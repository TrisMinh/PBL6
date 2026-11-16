import type { ReactElement } from "react";
import { useHoldCountdown } from "@/features/booking/hooks/useHoldCountdown";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  submitCheckoutAction,
  useSePay,
  livePaymentPath,
} from "../checkoutAction";
import { Link, useParams, useSearchParams } from "react-router";
import { z } from "zod";
import { liveApiJson as apiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { PaymentAccessNotice } from "../components/PaymentAccessNotice";
import { bookingSchema, backendTicketSchema } from "@/shared/api/contracts";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { ApiError } from "@/shared/api/error";
import { Button } from "@/shared/ui/Button/Button";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { stateLabel } from "@/shared/api/livePresentation";
import "./BackendPaymentPage.css";
import { LiveCheckoutView } from "../components/LiveCheckoutView";
import { LivePaymentRecovery } from "../components/LivePaymentRecovery";

const paymentSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  status: z.string(),
  amount: z.number(),
  currency: z.string(),
  providerAction: z.record(z.string(), z.string()).nullish(),
});
const guid = z.string().uuid();
export function BackendPaymentPage(): ReactElement {
  const [method] = useState(useSePay ? "BANK_TRANSFER" : "VNPAY");
  const { bookingId = "" } = useParams();
  const query = useQuery({
    queryKey: liveQueryKey("booking", bookingId),
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/bookings/${encodeURIComponent(bookingId)}`,
        bookingSchema,
        { signal },
      ),
    enabled: guid.safeParse(bookingId).success,
    retry: false,
  });
  const countdown = useHoldCountdown(query.data?.expiresAt ?? "");
  const paymentExpired =
    query.data?.status === "EXPIRED" ||
    (query.data?.status === "PENDING_PAYMENT" && countdown.isExpired);
  const remainingTime = `${Math.floor(countdown.remainingSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(countdown.remainingSeconds % 60)
    .toString()
    .padStart(2, "0")}`;
  const mutation = useMutation({
    mutationFn: async () => {
      if (
        query.data?.status !== "PENDING_PAYMENT" ||
        !Number.isFinite(Date.parse(query.data.expiresAt)) ||
        Date.parse(query.data.expiresAt) <= Date.now()
      )
        throw new ApiError(
          "BOOKING_EXPIRED",
          409,
          "Đơn không còn trong thời gian thanh toán. Vui lòng kiểm tra lại đơn.",
        );
      const payment = await apiJson(
        `/api/v1/bookings/${bookingId}/payments`,
        paymentSchema,
        {
          method: "POST",
          idempotent: true,
          body: {
            provider: useSePay ? "SEPAY" : "VNPAY_SANDBOX",
            method,
            returnUri: `${window.location.origin}/payment/${useSePay ? "sepay" : "vnpay"}/return?bookingId=${bookingId}`,
          },
        },
      );
      if (payment.status === "SUCCEEDED") return null;
      if (payment.providerAction?.type === "FORM_POST") {
        submitCheckoutAction(payment.providerAction);
        return payment;
      }
      const redirect = payment.providerAction?.redirectUri;
      if (!redirect)
        throw new ApiError(
          "CHECKOUT_UNAVAILABLE",
          409,
          "Chưa thể mở cổng thanh toán. Vui lòng kiểm tra lại trạng thái đơn.",
        );
      const url = new URL(redirect);
      if (
        url.protocol !== "https:" &&
        !(
          ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        )
      )
        throw new ApiError(
          "INVALID_REDIRECT",
          0,
          "Đường dẫn thanh toán không hợp lệ.",
        );
      window.location.assign(url.href);
      return payment;
    },
    retry: false,
  });
  if (!guid.safeParse(bookingId).success)
    return (
      <section className="live-api">
        <h1>Thanh toán SePay</h1>
        <p role="alert">Mã đơn không hợp lệ.</p>
      </section>
    );
  if (
    query.error instanceof ApiError &&
    [401, 403, 404].includes(query.error.status)
  )
    return (
      <PaymentAccessNotice
        kind="booking"
        returnTo={livePaymentPath(bookingId)}
      />
    );
  if (query.data?.status === "PENDING_PAYMENT" && !paymentExpired)
    return (
      <LiveCheckoutView
        providerName={useSePay ? "SePay" : "VNPay"}
        booking={query.data}
        remainingTime={remainingTime}
        onPay={() => mutation.mutate()}
        busy={mutation.isPending}
        error={mutation.error}
      />
    );
  return (
    <section className="live-api live-payment">
      <header className="live-api__heading">
        <div>
          <p className="live-api__eyebrow">HOÀN TẤT HÀNH TRÌNH CỦA BẠN</p>
          <h1>Thanh toán đặt vé</h1>
          <p>Kiểm tra đơn và chọn phương thức thanh toán phù hợp.</p>
        </div>
        <Link to="/account/tickets">Đơn đặt vé của tôi →</Link>
      </header>
      {query.isPending ? (
        <p role="status">Đang tải đơn…</p>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="live-payment__receipt">
            <div>
              <span>MÃ ĐẶT VÉ</span>
              <strong>{query.data.code}</strong>
              <small>{stateLabel(query.data.status)}</small>
            </div>
            <div>
              <span>TỔNG THANH TOÁN</span>
              <strong>{formatCurrencyVnd(query.data.total)}</strong>
            </div>
          </div>
          {paymentExpired && (
            <div className="live-payment__expired" role="alert">
              <span className="live-payment__expired-icon" aria-hidden="true">
                !
              </span>
              <div>
                <h2>Đã hết thời gian giữ ghế</h2>
                <p>
                  Đơn này không thể tiếp tục thanh toán. Vui lòng tìm lại chuyến
                  và chọn ghế để tạo đơn mới.
                </p>
                <p>
                  Nếu bạn đã thanh toán, hãy kiểm tra trạng thái trong đơn đặt
                  vé của mình.
                </p>
                <div className="live-payment__expired-actions">
                  <Link to="/" className="live-payment__find-trip">
                    Tìm chuyến khác
                  </Link>
                </div>
              </div>
            </div>
          )}
          {query.data.status === "PENDING_PAYMENT" && !paymentExpired && (
            <div
              className="live-payment__countdown"
              data-expiring={countdown.remainingSeconds <= 60}
            >
              <div>
                <strong>Thời gian giữ ghế còn lại</strong>
                <p>Hoàn tất thanh toán trước khi hết hạn để giữ chỗ của bạn.</p>
              </div>
              <span role="timer" aria-label="Thời gian giữ ghế còn lại">
                {remainingTime}
              </span>
            </div>
          )}
          {!paymentExpired && (
            <Link to="/account/tickets">Xem đơn và vé của tôi →</Link>
          )}
        </>
      )}
      {mutation.isError && <ApiFailure error={mutation.error} />}
      {mutation.isSuccess && mutation.data === null && (
        <Link to="/account/tickets">Giao dịch đã hoàn tất. Xem vé</Link>
      )}
    </section>
  );
}
const FINAL_PAYMENT_STATUSES = [
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "REFUND_PENDING",
];
/** POST /api/v1/payments/{id}/cancel: lets the customer abandon a payment that has not finished. */
function CancelPaymentButton({
  paymentId,
  onDone,
}: {
  paymentId: string;
  onDone: () => void;
}): ReactElement {
  const [key] = useState(() => crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: () =>
      apiJson(
        `/api/v1/payments/${encodeURIComponent(paymentId)}/cancel`,
        z.unknown(),
        { method: "POST", idempotencyKey: key },
      ),
    onSuccess: onDone,
    retry: false,
  });
  return (
    <>
      <Button
        isLoading={mutation.isPending}
        onClick={() => mutation.mutate()}
        variant="secondary"
      >
        Hủy giao dịch
      </Button>
      {mutation.isError && <ApiFailure error={mutation.error} />}
    </>
  );
}
export function BackendPaymentReturnPage(): ReactElement {
  const [params] = useSearchParams();
  const bookingId = params.get("bookingId") ?? "";
  const validId = guid.safeParse(bookingId).success;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: liveQueryKey("payment-return", bookingId),
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/bookings/${bookingId}/payments`,
        z.array(paymentSchema),
        { signal },
      ),
    enabled: validId,
    retry: false,
    refetchInterval: (q) => {
      const status = q.state.data?.[0]?.status;
      // Capture can still become REFUND_PENDING if booking rejects a delayed event.
      if (status === "SUCCEEDED")
        return queryClient.getQueryData<unknown[]>(
          liveQueryKey("booking-tickets", bookingId),
        )?.length
          ? false
          : 3000;
      return status && FINAL_PAYMENT_STATUSES.includes(status) ? false : 3000;
    },
  });
  const payment = query.data?.[0];
  const captured = payment?.status === "SUCCEEDED";
  const tickets = useQuery({
    queryKey: liveQueryKey("booking-tickets", bookingId),
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/bookings/${bookingId}/tickets`,
        z.array(backendTicketSchema),
        { signal },
      ),
    enabled: validId && captured,
    retry: false,
    refetchInterval: (q) => (q.state.data?.length ? false : 3000),
  });
  const failed =
    payment && ["FAILED", "CANCELLED"].includes(payment.status)
      ? payment
      : undefined;
  const pendingRefund = payment?.status === "REFUND_PENDING";
  if (
    query.error instanceof ApiError &&
    [401, 403, 404].includes(query.error.status)
  )
    return (
      <PaymentAccessNotice
        returnTo={`/payment/${useSePay ? "sepay" : "vnpay"}/return?bookingId=${bookingId}`}
      />
    );
  if (failed && !query.isError)
    return (
      <LivePaymentRecovery
        bookingId={bookingId}
        payment={failed}
        checking={query.isFetching}
        checkedAt={query.dataUpdatedAt}
        onRecheck={() => query.refetch()}
      />
    );
  const issued = captured && !!tickets.data?.length;
  return (
    <section className="live-api live-payment-result">
      <header className="live-api__heading">
        <div>
          <p className="live-api__eyebrow">KẾT QUẢ GIAO DỊCH</p>
          <h1>
            {issued
              ? "Thanh toán thành công"
              : pendingRefund
                ? "Thanh toán cần xử lý hoàn tiền"
                : captured
                  ? "Đã nhận thanh toán"
                  : "Đang chờ xác nhận thanh toán"}
          </h1>
          <p>
            {issued
              ? "Vé đã được phát hành và lưu trong tài khoản của bạn."
              : pendingRefund
                ? "Đơn đã đóng hoặc hết thời gian giữ ghế. Yêu cầu hoàn tiền đã được ghi nhận để xử lý."
                : captured
                  ? "Hệ thống đang hoàn tất phát hành vé. Trang sẽ tự cập nhật."
                  : "BLUE đang kiểm tra trạng thái giao dịch từ máy chủ."}
          </p>
        </div>
      </header>
      {!validId ? (
        <p role="alert">
          Mã đơn không hợp lệ. Vui lòng kiểm tra trong tài khoản.
        </p>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="live-payment-result__receipt">
            <span>TRẠNG THÁI GIAO DỊCH</span>
            <strong role="status">
              {payment ? stateLabel(payment.status) : "Đang chờ xác nhận…"}
            </strong>
            {payment && (
              <>
                <span>SỐ TIỀN</span>
                <strong>{formatCurrencyVnd(payment.amount)}</strong>
              </>
            )}
          </div>
          {tickets.isError && (
            <ApiFailure
              error={tickets.error}
              retry={() => void tickets.refetch()}
            />
          )}
          {issued && (
            <div className="live-payment-result__tickets">
              {tickets.data?.map((ticket) => (
                <article key={ticket.id}>
                  <span>VÉ ĐIỆN TỬ · GHẾ {ticket.seatCode}</span>
                  <h2>{ticket.passengerName}</h2>
                  <p>{ticket.publicCode}</p>
                  <Link
                    className="live-payment-result__ticket-link"
                    to={`/tickets/${ticket.id}`}
                  >
                    Xem vé điện tử →
                  </Link>
                </article>
              ))}
            </div>
          )}
          {payment && !FINAL_PAYMENT_STATUSES.includes(payment.status) && (
            <CancelPaymentButton
              paymentId={payment.id}
              onDone={() => void query.refetch()}
            />
          )}
          <Button
            variant="secondary"
            onClick={() => {
              void query.refetch();
              if (captured) void tickets.refetch();
            }}
          >
            Kiểm tra lại trạng thái
          </Button>
        </>
      )}
      <Link className="live-checkout__back" to="/account/tickets">
        Về vé của tôi →
      </Link>
    </section>
  );
}
