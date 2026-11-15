import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import type { ReactElement } from "react";
import { z } from "zod";
import { bookingSchema, backendSeatSchema } from "@/shared/api/contracts";
import { apiJson } from "@/shared/api/client";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import { formatCurrencyVnd as money } from "@/shared/lib/formatCurrencyVnd";
import { Button } from "@/shared/ui/Button/Button";
import { ProviderPanel } from "./PaymentCheckout";
import safety from "@/assets/payment/payment-safety.svg";
import bus from "@/assets/cancellation/bus.svg";
import "./PaymentCheckout.css";
import "../pages/PaymentPage.css";
import "../../cancellation/pages/CancellationPage.css";
import "./LiveCheckoutView.css";

interface Props {
  booking: z.infer<typeof bookingSchema>;
  remainingTime: string;
  onPay: () => void;
  busy: boolean;
  error: Error | null;
}
export function LiveCheckoutView({
  booking,
  remainingTime,
  onPay,
  busy,
  error,
}: Props): ReactElement {
  const trip = useQuery({
    queryKey: liveQueryKey("checkout-trip", booking.tripId),
    queryFn: ({ signal }) => getBackendTrip(booking.tripId, signal),
    retry: false,
  });
  const seats = useQuery({
    queryKey: liveQueryKey("checkout-seats", booking.tripId),
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/trips/${booking.tripId}/seats`,
        z.object({ seats: z.array(backendSeatSchema) }),
        { signal, auth: false },
      ),
    retry: false,
  });
  const payments = useQuery({
    queryKey: liveQueryKey("checkout-payments", booking.id),
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/bookings/${booking.id}/payments`,
        z.array(z.object({ id: z.string(), status: z.string() })),
        { signal },
      ),
    retry: false,
  });
  const transaction = payments.data?.find((p) =>
    ["CREATED", "PENDING", "PROCESSING"].includes(p.status),
  );
  const seatCodes = booking.items
    .map(
      (item) => seats.data?.seats.find((seat) => seat.id === item.seatId)?.code,
    )
    .filter(Boolean);
  return (
    <section className="payment-page live-checkout">
      <header className="payment-page__heading">
        <nav aria-label="Tiến trình đặt vé">
          Chuyến đi → Chọn ghế → Hành khách → Thanh toán
        </nav>
        <h1>Thanh toán đơn đặt vé</h1>
        <p>Hoàn tất giao dịch trên VNPay trong thời gian giữ chỗ.</p>
      </header>
      <div className="live-checkout__columns">
        <section
          className="payment-checkout"
          aria-label="Thanh toán VNPay Sandbox"
        >
          <header className="payment-checkout__intro">
            <h2>Thanh toán an toàn qua VNPay</h2>
            <p>
              Bạn sẽ được chuyển tới VNPay Sandbox để chọn ngân hàng và xác nhận
              giao dịch.
            </p>
          </header>
          <div className="payment-checkout__grid">
            <ProviderPanel amount={booking.total} label="VNPay Sandbox" />
            <div className="payment-checkout__details">
              <h3>Thông tin giao dịch</h3>
              <p>Dữ liệu do máy chủ BLUE tạo riêng cho đơn đặt vé này.</p>
              <dl>
                <div>
                  <dt>NHÀ CUNG CẤP</dt>
                  <dd>VNPay · Môi trường Sandbox</dd>
                </div>
                <div>
                  <dt>MÃ ĐẶT CHỖ</dt>
                  <dd>
                    {booking.code}
                    <span>Đã xác thực</span>
                  </dd>
                </div>
                <div>
                  <dt>TRẠNG THÁI</dt>
                  <dd>Chờ khách hàng xác nhận</dd>
                </div>
                <div>
                  <dt>SỐ TIỀN</dt>
                  <dd>{money(booking.total)}</dd>
                </div>
                <div className="payment-checkout__reference">
                  <dt>MÃ THAM CHIẾU THANH TOÁN</dt>
                  <dd>{transaction?.id ?? "Được tạo khi tiếp tục"}</dd>
                  <small>Mã do hệ thống tạo · không chỉnh sửa</small>
                </div>
              </dl>
            </div>
          </div>
          <div className="payment-checkout__safety">
            <img src={safety} alt="" width={24} height={24} />
            <div>
              <strong>Kiểm tra đúng số tiền trước khi chuyển tới VNPay</strong>
              <p>
                Sau khi quay lại, BLUE sẽ kiểm tra trạng thái từ máy chủ — không
                dựa vào nội dung redirect.
              </p>
            </div>
          </div>
        </section>
        <aside
          className="cancellation-page__summary"
          aria-label="Đơn hàng của bạn"
        >
          <div className="cancellation-page__summary-title">
            <h2>Đơn hàng của bạn</h2>
            <span role="timer" aria-label="Thời gian giữ ghế còn lại">
              {remainingTime}
            </span>
          </div>
          <div className="cancellation-page__summary-operator">
            <span className="cancellation-page__icon-well">
              <img src={bus} alt="" width={24} height={24} />
            </span>
            <div>
              <span>NHÀ XE VẬN HÀNH</span>
              <strong>{trip.data?.operatorName ?? "Đang tải nhà xe…"}</strong>
              <small>Đơn đặt vé · {booking.code}</small>
            </div>
          </div>
          <div className="cancellation-page__summary-route">
            <strong>
              {trip.data
                ? `${trip.data.origin} → ${trip.data.destination}`
                : "Đang tải hành trình…"}
            </strong>
            <small>
              {trip.data &&
                new Date(trip.data.departureAt).toLocaleString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
            </small>
            <span>
              {seatCodes.length > 0 ? `${seatCodes.join(", ")} · ` : ""}
              {booking.items.length} hành khách
            </span>
          </div>
          {trip.isError && (
            <ApiFailure error={trip.error} retry={() => void trip.refetch()} />
          )}
          <dl className="cancellation-page__amounts">
            {[
              ["Giá vé", booking.subtotal],
              ["Phí dịch vụ", booking.fee],
              ["Giảm giá", booking.discount],
              ["Tổng thanh toán", booking.total],
            ].map(([label, amount]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{typeof amount === "number" ? money(amount) : "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="cancellation-page__payment-method">
            <span>CỔNG THANH TOÁN</span>
            <strong>VNPay Sandbox</strong>
            <small>Xác nhận kết quả từ máy chủ</small>
          </div>
          <Button
            isLoading={busy}
            disabled={remainingTime === "00:00"}
            onClick={onPay}
          >
            Tiếp tục đến VNPay
          </Button>
          <Link className="live-checkout__back" to="/account/tickets">
            Kiểm tra đơn đặt vé
          </Link>
          {error && <ApiFailure error={error} />}
          <small className="cancellation-page__summary-footnote">
            BLUE không yêu cầu ảnh chuyển khoản và không xác nhận vé chỉ từ
            trang quay lại.
          </small>
        </aside>
      </div>
    </section>
  );
}
