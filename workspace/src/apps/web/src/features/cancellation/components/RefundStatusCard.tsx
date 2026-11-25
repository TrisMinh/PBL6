import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactElement } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { bookingSchema } from "@/shared/api/contracts";
import { readApiSession } from "@/shared/api/session";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import statusDot from "@/assets/payment/status-dot.svg";
import safety from "@/assets/payment/processing-safety.svg";
import {
  isRefundPending,
  isSimulatedRefund,
  refundStatusLabel,
  type LiveRefund,
} from "../schemas/liveRefund";
import "../pages/CancellationPage.css";
import "../pages/LiveRefundPage.css";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

function useProgressStep(target: number, animateOnMount: boolean): number {
  const [step, setStep] = useState(() =>
    animateOnMount &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? 0
      : target,
  );
  useEffect(() => {
    if (step === target) return;
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const advance = (): void => {
      setStep(preference?.matches || step > target ? target : step + 1);
    };
    const timer = window.setTimeout(
      advance,
      preference?.matches || step > target ? 0 : 650,
    );
    return () => window.clearTimeout(timer);
  }, [step, target]);
  return Math.min(step, target);
}

export function RefundStatusCard({
  refund,
  animateOnMount = false,
}: {
  refund: LiveRefund;
  animateOnMount?: boolean;
}): ReactElement {
  const journey = useQuery({
    queryKey: [
      "live-api",
      readApiSession()?.user.id,
      "refund-journey",
      refund.bookingId,
      refund.paymentId,
    ],
    queryFn: async ({ signal }) => {
      const booking = await apiJson(
        `/api/v1/bookings/${refund.bookingId}`,
        bookingSchema,
        { signal },
      );
      const [trip, payment] = await Promise.all([
        getBackendTrip(booking.tripId, signal),
        apiJson(
          `/api/v1/payments/${refund.paymentId}`,
          z.object({ provider: z.string() }),
          { signal },
        ),
      ]);
      return { booking, trip, payment };
    },
    retry: false,
  });
  const pending = isRefundPending(refund.status);
  const processing = refund.status === "PROCESSING";
  const succeeded = refund.status === "SUCCEEDED";
  const failed = refund.status === "FAILED";
  const finished = succeeded || failed || refund.status === "CANCELLED";
  const step = useProgressStep(
    finished ? 2 : processing ? 1 : 0,
    animateOnMount,
  );
  const showResult = finished && step === 2;
  const cancelled =
    refund.reason === "CUSTOMER_CANCELLATION" ||
    ["CANCELLED", "REFUND_PENDING", "REFUNDED", "PARTIALLY_REFUNDED"].includes(
      journey.data?.booking.status ?? "",
    );
  const providerCode = refund.paymentProvider ?? journey.data?.payment.provider;
  const simulated = isSimulatedRefund(providerCode);
  const status = refundStatusLabel(refund.status, providerCode);
  const provider = providerCode?.startsWith("VNPAY") ? "VNPay" : providerCode;
  const processingText =
    processing && provider ? `${provider} đang xử lý hoàn tiền` : status;
  const statusText = showResult
    ? status
    : step === 0
      ? "Đã tiếp nhận yêu cầu hoàn tiền"
      : finished
        ? "Đang hiển thị kết quả"
        : processingText;
  const departure = journey.data
    ? new Date(journey.data.trip.departureAt)
    : null;
  return (
    <section
      className="cancellation-page__refund live-refund"
      data-status={showResult ? refund.status : undefined}
      data-step={step}
      aria-label={`Khoản hoàn tiền ${refund.refundReference}`}
    >
      <div className="cancellation-page__refund-brand">
        <strong>BLUE</strong>
        <i />
        <img src={statusDot} alt="" />
        <span>HOÀN TIỀN</span>
        <small>MÃ {refund.refundReference}</small>
      </div>
      <h2>
        {journey.data
          ? `${journey.data.trip.origin} → ${journey.data.trip.destination}`
          : "Thông tin hoàn tiền"}
      </h2>
      {journey.data && (
        <p>
          {departure?.toLocaleDateString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            weekday: "long",
          })}
          ,{" "}
          {departure?.toLocaleDateString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}{" "}
          · Khởi hành{" "}
          {departure?.toLocaleTimeString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
      {journey.isError && (
        <ApiFailure
          error={journey.error}
          retry={() => void journey.refetch()}
        />
      )}
      <div className="cancellation-page__refund-divider" />
      <div className="cancellation-page__refund-body">
        <div className="cancellation-page__refund-facts">
          <span>CHI TIẾT HOÀN TIỀN</span>
          <dl>
            <div>
              <dt>TRẠNG THÁI</dt>
              <dd className="live-refund__status" role="status">
                {showResult && succeeded && (
                  <CheckCircle size={19} weight="fill" aria-hidden />
                )}
                {statusText}
              </dd>
            </div>
            <div>
              <dt>SỐ TIỀN</dt>
              <dd>{money.format(refund.amount)}</dd>
            </div>
            <div>
              <dt>ĐƠN VỊ VẬN HÀNH</dt>
              <dd>{journey.data?.trip.operatorName ?? "—"}</dd>
            </div>
            <div>
              <dt>YÊU CẦU LÚC</dt>
              <dd>
                {refund.createdAt
                  ? new Date(refund.createdAt).toLocaleString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })
                  : "—"}
              </dd>
            </div>
          </dl>
          {pending && (
            <div className="cancellation-page__notice">
              <img src={safety} alt="" />
              <div>
                <strong>Không gửi lại yêu cầu hủy</strong>
                <small>
                  {cancelled
                    ? "Vé đã hủy. Khoản hoàn tiền được theo dõi riêng."
                    : "Yêu cầu hoàn tiền đang được theo dõi."}
                </small>
              </div>
            </div>
          )}
          <p>
            {simulated
              ? "Giao dịch thử nghiệm. Không có tiền được chuyển vào tài khoản ngân hàng."
              : pending
                ? "Trạng thái được cập nhật tự động khi bạn mở trang."
                : "Kết quả được cập nhật từ hệ thống thanh toán."}
          </p>
        </div>
        <div className="cancellation-page__progress live-refund__progress">
          <span>TIẾN TRÌNH</span>
          <ol>
            <li
              data-phase={step === 0 ? "current" : "complete"}
              aria-current={step === 0 ? "step" : undefined}
            >
              <strong>
                {cancelled ? "Vé đã hủy" : "Đã tiếp nhận yêu cầu"}
              </strong>
              <small>
                {cancelled
                  ? "Đã ghi nhận hủy vé"
                  : "Theo dõi hoàn tiền của giao dịch"}
              </small>
            </li>
            <li
              data-phase={
                step === 1 ? "current" : step === 2 ? "complete" : "upcoming"
              }
              aria-current={step === 1 ? "step" : undefined}
            >
              <strong>Xử lý hoàn tiền</strong>
              <small>
                {step > 0 && processing
                  ? processingText
                  : step > 0 && finished
                    ? "Đã có kết quả xử lý"
                    : "Chờ tiếp nhận xử lý"}
              </small>
            </li>
            <li
              data-phase={
                showResult && succeeded
                  ? "success"
                  : showResult && failed
                    ? "failure"
                    : showResult
                      ? "complete"
                      : "upcoming"
              }
              aria-current={showResult ? "step" : undefined}
            >
              <strong>{showResult ? status : "Kết quả hoàn tiền"}</strong>
              {pending && <small>Tự động cập nhật khi xử lý hoàn tất</small>}
            </li>
          </ol>
          {cancelled && pending && (
            <p>Vé vẫn ở trạng thái đã hủy trong khi hoàn tiền đang xử lý.</p>
          )}
        </div>
      </div>
    </section>
  );
}
