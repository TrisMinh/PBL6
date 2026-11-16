import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactElement } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { z } from "zod";
import { useHoldCountdown } from "@/features/booking/hooks/useHoldCountdown";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { bookingSchema } from "@/shared/api/contracts";
import { liveApiJson as apiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { ApiError } from "@/shared/api/error";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { bookingReviewPath, ROUTES } from "@/shared/config/routes";
import { submitCheckoutAction } from "../checkoutAction";
import { livePaymentSchema } from "../schemas/livePayment.schema";
import { PaymentAccessNotice } from "../components/PaymentAccessNotice";

const method = z.enum(["BANK_TRANSFER", "NAPAS_BANK_TRANSFER", "CARD"]);
const methodSchema = z.object({
  provider: z.literal("SEPAY"),
  configured: z.boolean(),
  methods: z.array(method),
});

function resultPath(bookingId: string): string {
  return `/payment/sepay/return?bookingId=${bookingId}`;
}

function OpeningSePay({
  bookingId,
  expiresAt,
  paymentMethod,
  back,
}: {
  bookingId: string;
  expiresAt: string;
  paymentMethod: z.infer<typeof method>;
  back: string;
}): ReactElement {
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [failedAttempt, setFailedAttempt] = useState<number>();
  const result = resultPath(bookingId);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    // Wait until effect setup completes so Strict Mode does not send two requests.
    void Promise.resolve().then(async () => {
      if (signal.aborted || Date.parse(expiresAt) <= Date.now()) return;
      try {
        const payment = await apiJson(
          `/api/v1/bookings/${bookingId}/payments`,
          livePaymentSchema,
          {
            method: "POST",
            idempotent: true,
            signal,
            body: {
              provider: "SEPAY",
              method: paymentMethod,
              returnUri: window.location.origin + result,
            },
          },
        );
        if (signal.aborted) return;
        if (payment.bookingId !== bookingId || payment.provider !== "SEPAY")
          throw new Error("Giao dịch không khớp với đơn đặt vé.");
        if (payment.status === "SUCCEEDED") {
          void navigate(result, { replace: true });
          return;
        }
        if (payment.providerAction?.type !== "FORM_POST")
          throw new Error("Chưa thể mở trang thanh toán SePay.");
        submitCheckoutAction(payment.providerAction);
      } catch {
        if (!signal.aborted) setFailedAttempt(attempt);
      }
    });
    return () => controller.abort();
  }, [attempt, bookingId, expiresAt, navigate, paymentMethod, result]);

  if (failedAttempt === attempt)
    return (
      <PageState
        title="Chưa thể mở trang thanh toán SePay"
        description="Bạn có thể thử mở lại trang thanh toán cho đơn này."
        action={
          <>
            <Button onClick={() => setAttempt(attempt + 1)}>Thử lại</Button>
            <Link to={back}>Quay lại</Link>
          </>
        }
      />
    );
  return (
    <PageState
      title="Đang mở trang thanh toán SePay"
      description="Vui lòng đợi trong giây lát."
      action={<Link to={back}>Quay lại</Link>}
    />
  );
}

export function SePayCheckoutPage(): ReactElement {
  const { bookingId = "" } = useParams();
  const draft = useBookingDraftStore((state) => state.draft);
  const back =
    draft && draft.bookingId === bookingId
      ? bookingReviewPath(draft.sessionId)
      : ROUTES.accountTickets;
  const validId = z.uuid().safeParse(bookingId).success;
  const booking = useQuery({
    queryKey: liveQueryKey("booking", bookingId),
    queryFn: ({ signal }) =>
      apiJson(`/api/v1/bookings/${bookingId}`, bookingSchema, { signal }),
    enabled: validId,
    retry: false,
  });
  const countdown = useHoldCountdown(booking.data?.expiresAt ?? "");
  const status = booking.data?.status;
  const expired = countdown.isExpired;
  const active = status === "PENDING_PAYMENT" && !expired;
  const provider = useQuery({
    queryKey: ["payment-methods"],
    queryFn: ({ signal }) =>
      apiJson("/api/v1/payment-methods", methodSchema, { signal, auth: false }),
    enabled: active,
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
  if (
    booking.error instanceof ApiError &&
    [401, 403, 404].includes(booking.error.status)
  )
    return (
      <PaymentAccessNotice
        kind="booking"
        returnTo={`/payment/${bookingId}/sepay`}
      />
    );
  if (booking.error || (active && provider.error))
    return (
      <PageState
        title="Chưa thể tải thông tin thanh toán"
        description="Kiểm tra kết nối và thử lại."
        action={
          <Button
            onClick={() =>
              void (booking.error ? booking.refetch() : provider.refetch())
            }
          >
            Thử lại
          </Button>
        }
      />
    );
  if (status === "EXPIRED" || (status === "PENDING_PAYMENT" && expired))
    return (
      <PageState
        title="Đã hết thời gian giữ ghế"
        description="Chọn chuyến và giữ ghế mới để tiếp tục đặt vé."
        action={<Link to={ROUTES.trips}>Tìm chuyến khác</Link>}
      />
    );
  if (status && status !== "PENDING_PAYMENT")
    return <Navigate to={resultPath(bookingId)} replace />;
  if (!booking.data || !provider.data)
    return (
      <PageState
        title="Đang tải thông tin thanh toán"
        description="Vui lòng đợi trong giây lát."
      />
    );

  const methods = provider.data.methods;
  const paymentMethod = methods.includes("BANK_TRANSFER")
    ? "BANK_TRANSFER"
    : methods[0];
  if (!provider.data.configured || !paymentMethod)
    return (
      <PageState
        title="Cổng thanh toán SePay chưa sẵn sàng"
        description="Vui lòng thử lại sau."
        action={<Link to={back}>Quay lại</Link>}
      />
    );
  return (
    <OpeningSePay
      key={bookingId}
      bookingId={bookingId}
      expiresAt={booking.data.expiresAt}
      paymentMethod={paymentMethod}
      back={back}
    />
  );
}
