import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { z } from "zod";
import { BookingSummary } from "@/features/booking/components/BookingSummary/BookingSummary";
import { useHoldCountdown } from "@/features/booking/hooks/useHoldCountdown";
import { getLiveSeatLayout } from "@/features/booking/repositories/backendBookingRepository";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type { BookingDraft } from "@/features/booking/types/booking";
import { bookingSchema } from "@/shared/api/contracts";
import { liveApiJson as apiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { ApiError } from "@/shared/api/error";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { Toast } from "@/shared/ui/Toast/Toast";
import { bookingReviewPath, ROUTES } from "@/shared/config/routes";
import { submitCheckoutAction } from "../checkoutAction";
import { SePayGateway, type SePayMethod } from "../components/SePayGateway";
import { livePaymentSchema } from "../schemas/livePayment.schema";
import { PaymentAccessNotice } from "../components/PaymentAccessNotice";
import "../components/PaymentCheckout.css";
import "./PaymentPage.css";

const methodSchema = z.object({
  provider: z.literal("SEPAY"),
  environment: z.string(),
  configured: z.boolean(),
  methods: z.array(z.enum(["BANK_TRANSFER", "NAPAS_BANK_TRANSFER", "CARD"])),
});
export function SePayCheckoutPage(): ReactElement {
  const { bookingId = "" } = useParams();
  const navigate = useNavigate();
  const localDraft = useBookingDraftStore((state) => state.draft);
  const validId = z.string().uuid().safeParse(bookingId).success;
  const booking = useQuery({
    queryKey: liveQueryKey("booking", bookingId),
    queryFn: ({ signal }) =>
      apiJson(`/api/v1/bookings/${bookingId}`, bookingSchema, { signal }),
    enabled: validId,
    retry: false,
  });
  const tripId = booking.data?.tripId;
  const layout = useQuery({
    queryKey: liveQueryKey("checkout-layout", tripId),
    queryFn: ({ signal }) => {
      if (!tripId) throw new Error("Chưa có thông tin chuyến đi.");
      return getLiveSeatLayout(tripId, signal);
    },
    enabled: Boolean(tripId),
    retry: false,
  });
  const provider = useQuery({
    queryKey: ["payment-methods"],
    queryFn: ({ signal }) =>
      apiJson("/api/v1/payment-methods", methodSchema, { signal, auth: false }),
    retry: false,
  });
  const countdown = useHoldCountdown(booking.data?.expiresAt ?? "");
  const checkout = useMutation({
    mutationFn: async (method: SePayMethod) => {
      if (
        !booking.data ||
        booking.data.status !== "PENDING_PAYMENT" ||
        Date.parse(booking.data.expiresAt) <= Date.now()
      )
        throw new ApiError(
          "BOOKING_EXPIRED",
          409,
          "Đơn không còn trong thời gian thanh toán.",
        );
      if (!provider.data?.methods.includes(method))
        throw new ApiError(
          "PAYMENT_METHOD_UNAVAILABLE",
          409,
          "Phương thức thanh toán chưa được kích hoạt.",
        );
      const payment = await apiJson(
        `/api/v1/bookings/${bookingId}/payments`,
        livePaymentSchema,
        {
          method: "POST",
          idempotent: true,
          body: {
            provider: "SEPAY",
            method,
            returnUri: `${window.location.origin}/payment/sepay/return?bookingId=${bookingId}`,
          },
        },
      );
      if (payment.status === "SUCCEEDED") {
        navigate(`/payment/sepay/return?bookingId=${bookingId}`);
        return;
      }
      if (payment.providerAction?.type !== "FORM_POST")
        throw new ApiError(
          "CHECKOUT_UNAVAILABLE",
          409,
          "Chưa thể mở cổng thanh toán. Hãy kiểm tra lại giao dịch hiện tại.",
        );
      submitCheckoutAction(payment.providerAction);
    },
    retry: false,
  });
  if (!validId)
    return (
      <PageState
        title="Mã đơn không hợp lệ"
        description="Vui lòng mở lại đơn đặt vé."
        action={<Link to={ROUTES.trips}>Tìm chuyến</Link>}
      />
    );
  const error = booking.error ?? layout.error ?? provider.error;
  if (error instanceof ApiError && [401, 403, 404].includes(error.status))
    return (
      <PaymentAccessNotice
        kind="booking"
        returnTo={`/payment/${bookingId}/sepay`}
      />
    );
  if (error)
    return (
      <PageState
        title="Chưa thể tải thông tin thanh toán"
        description="Kiểm tra kết nối và thử lại. Đơn đặt vé được giữ nguyên."
        action={
          <Button
            onClick={() => {
              void booking.refetch();
              void layout.refetch();
              void provider.refetch();
            }}
          >
            Thử lại
          </Button>
        }
      />
    );
  if (!booking.data || !layout.data || !provider.data)
    return (
      <section>
        <h1>Thanh toán đơn đặt vé</h1>
        <p role="status">Đang tải thông tin thanh toán…</p>
      </section>
    );
  const data = booking.data;
  const sameDraft = localDraft?.bookingId === data.id ? localDraft : undefined;
  const draft: BookingDraft = {
    sessionId: sameDraft?.sessionId ?? data.id,
    bookingId: data.id,
    tripId: data.tripId,
    passengerCount: data.items.length,
    selectedSeatIds: data.items.map((item) => item.seatId),
    passengers: data.items.map((item) => ({
      seatId: item.seatId,
      fullName: item.fullName,
    })),
    contact: data.contact,
    expiresAt: data.expiresAt,
    totalVnd: data.total,
  };
  const back = sameDraft
    ? bookingReviewPath(sameDraft.sessionId)
    : ROUTES.accountTickets;
  const expired = countdown.isExpired || data.status === "EXPIRED";
  const active = data.status === "PENDING_PAYMENT" && !expired;
  return (
    <div className="payment-page payment-page--checkout">
      <header className="payment-page__heading">
        <nav aria-label="Tiến trình đặt vé">
          <Link to={back}>Quay lại kiểm tra thông tin</Link>
          <span aria-current="step">Thanh toán</span>
        </nav>
        <h1>Thanh toán đơn đặt vé</h1>
        <p>
          Chọn phương thức và theo dõi trạng thái thanh toán của đơn đặt vé.
        </p>
      </header>
      {checkout.error && (
        <Toast tone="error" message={checkout.error.message} />
      )}
      <div className="payment-page__checkout">
        <section className="payment-checkout" aria-label="Thanh toán SePay">
          {active ? (
            <SePayGateway
              methods={provider.data.methods}
              pending={checkout.isPending}
              onCheckout={(method) => checkout.mutate(method)}
            />
          ) : (
            <PageState
              title={
                expired
                  ? "Đã hết thời gian giữ ghế"
                  : "Kiểm tra giao dịch hiện tại"
              }
              description={
                expired
                  ? "Vui lòng tìm lại chuyến và chọn ghế để tạo đơn mới."
                  : "Đơn đặt vé đã có thay đổi. Kiểm tra kết quả trước khi thực hiện lại."
              }
              action={
                <Link
                  to={
                    expired
                      ? ROUTES.trips
                      : `/payment/sepay/return?bookingId=${data.id}`
                  }
                >
                  {expired ? "Tìm chuyến khác" : "Kiểm tra giao dịch"}
                </Link>
              }
            />
          )}
          {!provider.data.configured && (
            <Toast
              tone="error"
              message="Cổng SePay chưa được cấu hình đầy đủ trên máy chủ."
            />
          )}
          <details className="payment-checkout__transaction-details">
            <summary>Thông tin giao dịch</summary>
            <div className="payment-checkout__details">
              <dl>
                <div>
                  <dt>NHÀ CUNG CẤP</dt>
                  <dd>
                    SePay ·{" "}
                    {provider.data.environment === "production"
                      ? "Chính thức"
                      : "Sandbox"}
                  </dd>
                </div>
                <div>
                  <dt>MÃ ĐẶT CHỖ</dt>
                  <dd>
                    {data.code}
                    <span>Đã xác thực</span>
                  </dd>
                </div>
                <div>
                  <dt>SỐ TIỀN</dt>
                  <dd>{data.total.toLocaleString("vi-VN")} ₫</dd>
                </div>
              </dl>
            </div>
          </details>
        </section>
        <BookingSummary
          draft={draft}
          layout={layout.data}
          countdown={countdown}
          variant="payment"
          hint=""
          backHref={back}
          isPending={checkout.isPending}
          amounts={{
            subtotal: data.subtotal ?? data.total,
            fee: data.fee ?? 0,
            discount: data.discount ?? 0,
          }}
          paymentOptions={
            <div className="booking-summary__payment-method">
              <span>CỔNG THANH TOÁN</span>
              <strong>
                SePay{provider.data.environment === "sandbox" ? " Sandbox" : ""}
              </strong>
              <small>Xác nhận kết quả từ máy chủ</small>
            </div>
          }
          primaryAction={
            <div className="mock-gateway__waiting" role="status">
              <span />
              {active ? "Chờ xác nhận thanh toán" : "Kiểm tra trạng thái đơn"}
            </div>
          }
        />
      </div>
    </div>
  );
}
