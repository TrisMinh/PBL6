import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { Link } from "react-router";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { apiJson } from "@/shared/api/client";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { bookingSchema, pageOf } from "@/shared/api/contracts";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { formatDateTime } from "@/shared/lib/formatDateTime";
import { paymentCheckoutPath } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import "./PendingBookings.css";

async function pendingBookings(signal: AbortSignal): Promise<
  {
    id: string;
    code: string;
    total: number;
    expiresAt: string;
    passengerCount: number;
    route: string;
    departureAt: string;
    operator: string;
  }[]
> {
  const pending = [];
  for (let page = 0; ; page++) {
    const result = await apiJson(
      `/api/v1/bookings?page=${page}&size=100`,
      pageOf(bookingSchema),
      { signal },
    );
    pending.push(
      ...result.items.filter(
        (booking) =>
          booking.paymentChannel === "PREPAID" &&
          booking.status === "PENDING_PAYMENT" &&
          Date.parse(booking.expiresAt) > Date.now(),
      ),
    );
    if (page + 1 >= result.totalPages) break;
  }
  return Promise.all(
    pending.map(async (booking) => {
      const trip = await getBackendTrip(booking.tripId, signal);
      return {
        id: booking.id,
        code: booking.code,
        total: booking.total,
        expiresAt: booking.expiresAt,
        passengerCount: booking.items.length,
        route: `${trip.origin} → ${trip.destination}`,
        departureAt: trip.departureAt,
        operator: trip.operatorName,
      };
    }),
  );
}

export function PendingBookings(): ReactElement {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: liveQueryKey("pending-bookings"),
    queryFn: ({ signal }) => pendingBookings(signal),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const items = (query.data ?? []).filter((booking) =>
    `${booking.code} ${booking.route} ${booking.operator}`
      .toLocaleLowerCase("vi")
      .includes(search.trim().toLocaleLowerCase("vi")),
  );
  return (
    <section className="pending-bookings" aria-label="Đơn chờ thanh toán">
      <div className="pending-bookings__toolbar">
        <h2>Đơn chờ thanh toán</h2>
        <label>
          <span>Tìm đơn đặt vé</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Mã đặt vé, tuyến hoặc nhà xe"
          />
        </label>
      </div>
      {query.isPending ? (
        <BrandLoading compact title="Đang tải đơn đặt vé…" />
      ) : query.isError ? (
        <PageState
          title="Chưa tải được đơn đặt vé"
          description="Vui lòng thử lại."
          action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
        />
      ) : !items.length ? (
        <p className="account-tickets__empty">
          {search
            ? "Không tìm thấy đơn phù hợp."
            : "Bạn chưa có đơn chờ thanh toán còn hạn giữ ghế."}
        </p>
      ) : (
        <ul className="pending-bookings__list">
          {items.map((booking) => (
            <li key={booking.id}>
              <article className="pending-bookings__card">
                <header>
                  <code>{booking.code}</code>
                  <span className="pending-bookings__status">
                    <Clock size={16} aria-hidden />
                    Chờ thanh toán
                  </span>
                </header>
                <h3>{booking.route}</h3>
                <p>
                  {formatDateTime(booking.departureAt, "HH:mm dd/MM/yyyy")} ·{" "}
                  {booking.operator}
                </p>
                <dl>
                  <div>
                    <dt>Hành khách</dt>
                    <dd>{booking.passengerCount} người</dd>
                  </div>
                  <div>
                    <dt>Giữ ghế đến</dt>
                    <dd>{formatDateTime(booking.expiresAt, "HH:mm")}</dd>
                  </div>
                  <div>
                    <dt>Tổng tiền</dt>
                    <dd className="pending-bookings__amount">
                      {formatCurrencyVnd(booking.total)}
                    </dd>
                  </div>
                </dl>
                <footer>
                  <Link
                    className="pending-bookings__continue"
                    to={paymentCheckoutPath(booking.id)}
                  >
                    Tiếp tục thanh toán
                  </Link>
                  <Link
                    className="pending-bookings__check"
                    to={`/payment/sepay/return?bookingId=${booking.id}`}
                  >
                    Kiểm tra trạng thái
                  </Link>
                </footer>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
