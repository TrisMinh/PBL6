import type { ReactElement } from "react";
import { useHoldCountdown } from "@/features/booking/hooks/useHoldCountdown";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { z } from "zod";
import { liveApiJson as apiJson } from "@/shared/api/liveRequest";
import { bookingSchema } from "@/shared/api/contracts";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { ApiError } from "@/shared/api/error";
import { Button } from "@/shared/ui/Button/Button";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { stateLabel } from "@/shared/api/livePresentation";
import "./BackendPaymentPage.css";

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
  const [method, setMethod] = useState("VNPAY_QR");
  const { bookingId = "" } = useParams();
  const query = useQuery({
    queryKey: ["live-api", "booking", bookingId],
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
            provider: "VNPAY_SANDBOX",
            method,
            returnUri: `${window.location.origin}/payment/vnpay/return?bookingId=${bookingId}`,
          },
        },
      );
      if (payment.status === "SUCCEEDED") return null;
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
          import.meta.env.DEV &&
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
    return <p role="alert">Mã đơn không hợp lệ.</p>;
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
            <>
              <p>
                Thanh toán sẽ mở trên cổng VNPay. Vé được phát hành sau khi hệ
                thống xác nhận giao dịch.
              </p>
              <label>
                Phương thức thanh toán
                <select
                  value={method}
                  disabled={mutation.isPending}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="VNPAY_QR">VNPay QR</option>
                  <option value="ATM_CARD">Thẻ ATM nội địa</option>
                  <option value="BANK_ACCOUNT">Tài khoản ngân hàng</option>
                  <option value="VNPAY">Cổng VNPay</option>
                </select>
              </label>
              <Button
                disabled={
                  query.data.status !== "PENDING_PAYMENT" ||
                  countdown.remainingSeconds === 0
                }
                isLoading={mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                Thanh toán qua VNPay
              </Button>
            </>
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
  const query = useQuery({
    queryKey: ["live-api", "payment-return", bookingId],
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/bookings/${bookingId}/payments`,
        z.array(paymentSchema),
        { signal },
      ),
    enabled: guid.safeParse(bookingId).success,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.some((p) =>
        ["SUCCEEDED", "FAILED", "CANCELLED"].includes(p.status),
      )
        ? false
        : 5000,
  });
  return (
    <section className="live-api">
      <h1>Kết quả thanh toán</h1>
      <p>
        Kết quả được kiểm tra từ hệ thống, không dựa vào tham số do trình duyệt
        gửi về.
      </p>
      {!guid.safeParse(bookingId).success ? (
        <p>Vui lòng xem lại đơn và vé trong tài khoản.</p>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : query.data?.length ? (
        query.data.map((p) => (
          <p key={p.id}>
            Trạng thái giao dịch: {stateLabel(p.status)}{" "}
            {FINAL_PAYMENT_STATUSES.includes(p.status) ? null : (
              <CancelPaymentButton
                paymentId={p.id}
                onDone={() => void query.refetch()}
              />
            )}
          </p>
        ))
      ) : (
        <p role="status">Đang chờ xác nhận thanh toán…</p>
      )}
      <Link to="/account/tickets">Xem vé của tôi</Link>
    </section>
  );
}
