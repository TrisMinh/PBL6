import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { bookingSchema } from "@/shared/api/contracts";
import { readApiSession } from "@/shared/api/session";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import statusDot from "@/assets/payment/status-dot.svg";
import safety from "@/assets/payment/processing-safety.svg";
import progressRail from "@/assets/payment/progress-rail.svg";
import "./CancellationPage.css";
import "./LiveRefundPage.css";

const refundSchema = z.object({
  id: z.string().uuid(),
  refundReference: z.string(),
  paymentId: z.string().uuid(),
  bookingId: z.string().uuid(),
  amount: z.number().nonnegative(),
  currency: z.literal("VND"),
  status: z.string(),
  reason: z.string(),
});
const states: Record<string, string> = {
  REQUESTED: "Đã tiếp nhận yêu cầu hoàn tiền",
  PROCESSING: "Đang xử lý hoàn tiền",
  SUCCEEDED: "Hoàn tiền thành công",
  FAILED: "Hoàn tiền thất bại",
  CANCELLED: "Yêu cầu hoàn tiền đã hủy",
};

export function LiveRefundPage(): ReactElement {
  const { refundId = "" } = useParams();
  const session = readApiSession();
  const valid = z.string().uuid().safeParse(refundId).success;
  const query = useQuery({
    queryKey: ["live-api", session?.user.id, "customer-refund", refundId],
    enabled: !!session && valid,
    queryFn: ({ signal }) =>
      apiJson(`/api/v1/refunds/${encodeURIComponent(refundId)}`, refundSchema, {
        signal,
      }),
    refetchInterval: (q) =>
      ["REQUESTED", "PROCESSING"].includes(q.state.data?.status ?? "")
        ? 5000
        : false,
    retry: false,
  });
  const journey = useQuery({
    queryKey: [
      "live-api",
      session?.user.id,
      "refund-journey",
      query.data?.bookingId,
    ],
    enabled: !!query.data,
    queryFn: async ({ signal }) => {
      if (!query.data) throw new Error("Chưa có thông tin hoàn tiền.");
      const booking = await apiJson(
        `/api/v1/bookings/${query.data.bookingId}`,
        bookingSchema,
        { signal },
      );
      const [trip, payment] = await Promise.all([
        getBackendTrip(booking.tripId, signal),
        apiJson(
          `/api/v1/payments/${query.data.paymentId}`,
          z.object({ provider: z.string() }),
          { signal },
        ),
      ]);
      return { booking, trip, payment };
    },
    retry: false,
  });
  if (!valid)
    return (
      <section className="cancellation-page">
        <h1>Theo dõi hoàn tiền</h1>
        <p role="alert">Mã hoàn tiền không hợp lệ.</p>
      </section>
    );
  if (!session)
    return (
      <section className="cancellation-page">
        <h1>Theo dõi hoàn tiền</h1>
        <p>Đăng nhập tài khoản sở hữu đơn để xem thông tin hoàn tiền.</p>
        <Link to="/login" state={{ from: `/refunds/${refundId}` }}>
          Đăng nhập
        </Link>
      </section>
    );
  if (query.isPending)
    return (
      <section className="cancellation-page">
        <BrandLoading compact title="Đang tải thông tin hoàn tiền…" />
      </section>
    );
  if (query.isError)
    return (
      <section className="cancellation-page">
        <h1>Theo dõi hoàn tiền</h1>
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      </section>
    );
  const refund = query.data;
  const pending = ["REQUESTED", "PROCESSING"].includes(refund.status);
  const cancelled = [
    "CANCELLED",
    "REFUND_PENDING",
    "REFUNDED",
    "PARTIALLY_REFUNDED",
  ].includes(journey.data?.booking.status ?? "");
  const status = states[refund.status] ?? refund.status;
  const providerCode = journey.data?.payment.provider;
  const provider = providerCode?.startsWith("VNPAY") ? "VNPay" : providerCode;
  const processingText =
    refund.status === "PROCESSING" && provider
      ? `${provider} đang xử lý hoàn tiền`
      : status;
  const departure = journey.data
    ? new Date(journey.data.trip.departureAt)
    : null;
  return (
    <div
      className="cancellation-page cancellation-page--processing live-refund"
      data-status={refund.status}
    >
      <header className="cancellation-page__processing-heading">
        <p>
          <Link to="/account/tickets">Hành trình của tôi</Link> → Hủy vé → Hoàn
          tiền
        </p>
        <h1>Theo dõi hoàn tiền</h1>
      </header>
      <section className="cancellation-page__refund">
        <div className="cancellation-page__refund-brand">
          <strong>BLUE</strong>
          <i />
          <img src={statusDot} alt="" />
          <span>REFUND{pending ? " · TỰ ĐỘNG CẬP NHẬT" : ""}</span>
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
                <dd role="status">{processingText}</dd>
              </div>
              <div>
                <dt>SỐ TIỀN</dt>
                <dd>₫{new Intl.NumberFormat("vi-VN").format(refund.amount)}</dd>
              </div>
              <div>
                <dt>ĐƠN VỊ VẬN HÀNH</dt>
                <dd>{journey.data?.trip.operatorName ?? "—"}</dd>
              </div>
              <div>
                <dt>YÊU CẦU LÚC</dt>
                <dd>—</dd>
              </div>
            </dl>
            <div className="cancellation-page__notice">
              <img src={safety} alt="" />
              <div>
                <strong>Không gửi lại yêu cầu hủy</strong>
                <small>
                  {pending
                    ? cancelled
                      ? "Vé đã hủy; hoàn tiền được theo dõi độc lập."
                      : "Yêu cầu hoàn tiền được theo dõi độc lập."
                    : status}
                </small>
              </div>
            </div>
            <p>
              {pending
                ? "Trạng thái được cập nhật tự động khi bạn mở trang."
                : "Kết quả được cập nhật từ hệ thống thanh toán."}
            </p>
          </div>
          <div className="cancellation-page__progress live-refund__progress">
            <span>TIẾN TRÌNH</span>
            {refund.status === "PROCESSING" && (
              <img src={progressRail} alt="" width={28} height={174} />
            )}
            <ol data-illustrated={refund.status === "PROCESSING"}>
              <li data-complete="true">
                <strong>
                  {cancelled ? "Vé đã hủy" : "Đã tiếp nhận yêu cầu"}
                </strong>
                <small>
                  {cancelled
                    ? "Đã ghi nhận hủy vé"
                    : "Theo dõi hoàn tiền của giao dịch"}
                </small>
              </li>
              <li data-complete={refund.status !== "REQUESTED"}>
                <strong>
                  {pending ? "Đang hoàn tiền" : "Xử lý hoàn tiền"}
                </strong>
                <small>
                  {provider && refund.status === "PROCESSING"
                    ? `${provider} đang xử lý`
                    : status}
                </small>
              </li>
              <li data-complete={!pending}>
                <strong>{pending ? "Thông báo kết quả" : status}</strong>
                <small>
                  {pending
                    ? "Tự động cập nhật khi xử lý hoàn tất"
                    : "Đã có kết quả xử lý"}
                </small>
              </li>
            </ol>
            {cancelled && pending && (
              <p>Vé vẫn ở trạng thái đã hủy trong khi hoàn tiền đang xử lý.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
