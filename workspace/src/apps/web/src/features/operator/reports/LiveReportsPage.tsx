import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactElement } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { getLiveRows, liveQueryKey } from "@/shared/api/liveRequest";
import { normalizeSearch, stateLabel } from "@/shared/api/livePresentation";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { Button } from "@/shared/ui/Button/Button";
import { OperatorInput as Input } from "../components/OperatorInput";
import { reportFiltersSchema } from "./reports.schema";
import {
  getLiveReport,
  money,
  previousRange,
  shiftDate,
  type LiveReport,
  type ReportRange,
} from "./liveReports";
import { LiveRevenueChart } from "./LiveRevenueChart";
import calendar from "@/assets/operator/reports/imgFrame7.svg";
import chevron from "@/assets/operator/reports/imgFrame8.svg";
import ticketsIcon from "@/assets/operator/reports/imgFrame10.svg";
import customerIcon from "@/assets/operator/reports/imgFrame11.svg";
import searchIcon from "@/assets/operator/reports/imgFrame12.svg";
import ticketDate from "@/assets/operator/reports/imgFrame13.svg";
import seatIcon from "@/assets/operator/reports/imgFrame14.svg";
import revenueIcon from "@/assets/operator/reports/imgFrame15.svg";
import refundIcon from "@/assets/operator/reports/imgFrame16.svg";
import mapArt from "@/assets/operator/reports/imgMapIllustration.svg";
import mapRoads from "@/assets/operator/reports/imgGroup.svg";
import "./ReportsPage.css";
import "./LiveReportsPage.css";

const bookingSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  tripId: z.string(),
  contact: z.object({ fullName: z.string() }),
  items: z.array(z.unknown()),
});
type Booking = z.infer<typeof bookingSchema>;
const tripsSchema = z.array(
  z.object({
    id: z.string(),
    origin: z.string(),
    destination: z.string(),
    departureAt: z.string(),
    busType: z.string(),
    status: z.string(),
  }),
);
const dateLabel = (date: string): string => date.split("-").reverse().join("/");
const displayDate = (date: string): string =>
  new Date(date).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
function delta(value: number | null, previous: number | null): string {
  if (value === null || previous === null || (previous === 0 && value !== 0))
    return "—";
  const amount = previous === 0 ? 0 : ((value - previous) / previous) * 100;
  return `${amount > 0 ? "+" : ""}${amount.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}
function totals(
  report: LiveReport | undefined,
  bookings: Booking[] | undefined,
): Record<"revenue" | "refund" | "tickets" | "customers", number | null> {
  if (!report)
    return { revenue: null, refund: null, tickets: null, customers: null };
  const paid = report.bookings.filter((row) =>
    ["PAID", "CONFIRMED", "COMPLETED"].includes(row.status),
  );
  const known = new Map(bookings?.map((row) => [row.id, row]));
  const complete = report.bookings.every((row) => known.has(row.bookingid));
  return {
    revenue: report.revenue.reduce((sum, row) => sum + row.grossrevenue, 0),
    refund: report.revenue.reduce((sum, row) => sum + row.refundamount, 0),
    tickets: paid.every((row) => known.has(row.bookingid))
      ? paid.reduce(
          (sum, row) => sum + (known.get(row.bookingid)?.items.length ?? 0),
          0,
        )
      : null,
    customers: complete
      ? new Set(
          report.bookings.map((row) => known.get(row.bookingid)?.customerId),
        ).size
      : null,
  };
}
function DateRangeDialog({
  range,
  onApply,
  onClose,
}: {
  range: ReportRange;
  onApply: (range: ReportRange) => void;
  onClose: () => void;
}): ReactElement {
  const [from, setFrom] = useState(range.from),
    [to, setTo] = useState(range.to),
    [error, setError] = useState("");
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="operator-reports__overlay" />
        <Dialog.Content className="operator-reports__dialog live-reports__date-dialog">
          <Dialog.Title>Chọn thời gian báo cáo</Dialog.Title>
          <Dialog.Description>
            Thống kê theo ngày đặt vé, giờ Việt Nam.
          </Dialog.Description>
          <form
            className="operator-reports__range-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !reportFiltersSchema.safeParse({ from, to, period: "month" })
                  .success
              ) {
                setError("Chọn khoảng ngày hợp lệ, tối đa 366 ngày.");
                return;
              }
              onApply({ from, to });
            }}
          >
            <Input
              label="Từ ngày"
              type="date"
              required
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
            />
            <Input
              label="Đến ngày"
              type="date"
              required
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
            />
            {error && <p role="alert">{error}</p>}
            <footer>
              <Button type="button" variant="secondary" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit">Áp dụng</Button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function LiveReportsPage(): ReactElement {
  const [range, setRange] = useState<ReportRange>(() => {
    const today = getVietnamTodayDate();
    return { from: today.slice(0, 8) + "01", to: today };
  });
  const [dateOpen, setDateOpen] = useState(false),
    [period, setPeriod] = useState(0),
    [search, setSearch] = useState("");
  const previous = previousRange(range);
  const current = useQuery({
    queryKey: liveQueryKey("operator-report", range),
    queryFn: ({ signal }) => getLiveReport(range, signal),
  });
  const prior = useQuery({
    queryKey: liveQueryKey("operator-report", previous),
    queryFn: ({ signal }) => getLiveReport(previous, signal),
  });
  const bookings = useQuery({
    queryKey: liveQueryKey("operator-report-bookings"),
    queryFn: async ({ signal }) =>
      (await getLiveRows("/api/v1/operator/bookings", signal)).map((row) =>
        bookingSchema.parse(row),
      ),
  });
  const trips = useQuery({
    queryKey: liveQueryKey("operator-report-trips"),
    queryFn: async ({ signal }) =>
      tripsSchema.parse(await getLiveRows("/api/v1/operator/trips", signal)),
    refetchInterval: 60_000,
  });
  const currentTotals = totals(current.data, bookings.data),
    priorTotals = totals(prior.data, bookings.data);
  const metrics = [
    {
      label: "Doanh thu gộp",
      value: currentTotals.revenue,
      previous: priorTotals.revenue,
      icon: revenueIcon,
      isMoney: true,
    },
    {
      label: "Tiền hoàn",
      value: currentTotals.refund,
      previous: priorTotals.refund,
      icon: refundIcon,
      isMoney: true,
    },
    {
      label: "Vé đã xác nhận",
      value: currentTotals.tickets,
      previous: priorTotals.tickets,
      icon: ticketsIcon,
      isMoney: false,
    },
    {
      label: "Khách đặt vé",
      value: currentTotals.customers,
      previous: priorTotals.customers,
      icon: customerIcon,
      isMoney: false,
    },
  ];
  const known = new Map(bookings.data?.map((row) => [row.id, row]));
  const knownTrips = new Map(trips.data?.map((row) => [row.id, row]));
  const rows =
    current.data?.bookings
      .filter((row) => {
        const booking = known.get(row.bookingid);
        return normalizeSearch(
          `${row.bookingcode} ${booking?.contact.fullName ?? ""}`,
        ).includes(normalizeSearch(search));
      })
      .sort((a, b) => Date.parse(b.bookedat) - Date.parse(a.bookedat))
      .slice(0, 5) ?? [];
  const activeTrips =
    trips.data?.filter((trip) =>
      ["BOARDING", "DEPARTED", "IN_TRANSIT"].includes(trip.status),
    ) ?? [];
  const start = period ? shiftDate(range.from, (period - 1) * 7) : range.from;
  const end =
    period && shiftDate(start, 6) < range.to ? shiftDate(start, 6) : range.to;
  const count = Math.max(
    0,
    Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1,
  );
  const series = Array.from({ length: count }, (_, index) => {
    const date = shiftDate(start, index);
    return {
      date,
      revenue:
        current.data?.revenue
          .filter((row) => row.perioddate === date)
          .reduce((sum, row) => sum + row.grossrevenue, 0) ?? 0,
    };
  });
  return (
    <div className="operator-reports live-reports">
      <header className="live-reports__header">
        <h1>Báo cáo tổng quan</h1>
        <div className="operator-reports__header-actions">
          <button
            className="operator-reports__dates"
            type="button"
            onClick={() => setDateOpen(true)}
          >
            <img src={calendar} alt="" width={18} height={18} />
            <span>
              {dateLabel(range.from)} – {dateLabel(range.to)}
            </span>
            <img src={chevron} alt="" width={10} height={10} />
          </button>
          <NotificationBell />
        </div>
      </header>
      {current.isPending ? (
        <p className="live-reports__loading" role="status">
          Đang tải báo cáo…
        </p>
      ) : current.isError ? (
        <ApiFailure error={current.error} />
      ) : (
        <>
          <div className="operator-reports__top">
            <section
              className="operator-reports__metrics"
              aria-label="Chỉ số tổng quan"
            >
              {metrics.map((metric) => (
                <article
                  className="operator-reports__metric"
                  key={metric.label}
                >
                  <span className="operator-reports__metric-icon">
                    <img src={metric.icon} alt="" width={18} height={18} />
                  </span>
                  <strong>
                    {metric.value === null
                      ? "—"
                      : metric.isMoney
                        ? money(metric.value)
                        : metric.value.toLocaleString("vi-VN")}
                  </strong>
                  <p>{metric.label}</p>
                  <span className="operator-reports__delta">
                    {delta(metric.value, metric.previous)}
                  </span>
                  <small>so với kỳ trước</small>
                </article>
              ))}
            </section>
            <section
              className="operator-reports__revenue"
              aria-labelledby="live-revenue-title"
            >
              <header>
                <h2 id="live-revenue-title">Doanh thu</h2>
                <div role="group" aria-label="Kỳ biểu đồ">
                  {[1, 2, 3, 4, 0].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={value ? `Tuần ${value}` : "Toàn kỳ"}
                      aria-pressed={period === value}
                      onClick={() => setPeriod(value)}
                    >
                      {value ? `T${value}` : "Toàn kỳ"}
                    </button>
                  ))}
                </div>
              </header>
              <LiveRevenueChart
                key={`${range.from}-${range.to}-${period}`}
                series={series}
              />
            </section>
          </div>
          {prior.isError && (
            <p className="live-reports__notice" role="status">
              Không tải được kỳ trước để so sánh.
            </p>
          )}
          {bookings.isError && <ApiFailure error={bookings.error} />}
          <div className="operator-reports__bottom">
            <section
              className="operator-reports__recent"
              aria-labelledby="live-recent-title"
            >
              <header>
                <h2 id="live-recent-title">Đặt vé gần đây</h2>
                <label>
                  <img src={searchIcon} alt="" width={15} height={15} />
                  <input
                    aria-label="Tìm đặt vé"
                    placeholder="Tìm đặt vé"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </header>
              <div className="operator-reports__table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ĐẶT VÉ</th>
                      <th>KHỞI HÀNH</th>
                      <th>LOẠI XE</th>
                      <th>GHẾ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const booking = known.get(row.bookingid),
                        trip = booking
                          ? knownTrips.get(booking.tripId)
                          : undefined;
                      return (
                        <tr key={row.bookingid}>
                          <td>
                            <Link
                              to={`/operator/bookings?refundBooking=${row.bookingid}`}
                            >
                              {booking?.contact.fullName || row.bookingcode}
                            </Link>
                            <small>
                              {trip
                                ? `${trip.origin} → ${trip.destination}`
                                : row.bookingcode}
                            </small>
                          </td>
                          <td>
                            <span>
                              <img
                                src={ticketDate}
                                alt=""
                                width={14}
                                height={14}
                              />
                              {trip ? displayDate(trip.departureAt) : "—"}
                            </span>
                          </td>
                          <td>{trip ? stateLabel(trip.busType) : "—"}</td>
                          <td>
                            <span>
                              <img
                                src={seatIcon}
                                alt=""
                                width={14}
                                height={14}
                              />
                              {booking ? `${booking.items.length} chỗ` : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!rows.length && (
                  <p className="operator-reports__empty">
                    {search
                      ? "Không tìm thấy đặt vé phù hợp."
                      : "Chưa có đặt vé trong kỳ này."}
                  </p>
                )}
              </div>
              <Link
                className="live-reports__all-bookings"
                to="/operator/bookings"
              >
                Xem tất cả đặt vé →
              </Link>
            </section>
            <section className="operator-reports__live">
              <header>
                <h2>Vị trí xe đang chạy</h2>
                <Link className="live-reports__schedule" to="/operator/trips">
                  Lịch chuyến
                </Link>
              </header>
              <div className="live-reports__map">
                <div className="live-reports__map-art" aria-hidden="true">
                  <img src={mapArt} alt="" width={622} height={366} />
                  <img src={mapRoads} alt="" width={674.134} height={381.598} />
                </div>
                <div className="live-reports__gps-empty">
                  <strong>Chưa có dữ liệu định vị</strong>
                  <p>Vị trí xe sẽ hiển thị khi có dữ liệu GPS.</p>
                </div>
                <footer>
                  {trips.isPending
                    ? "Đang tải lịch chuyến…"
                    : trips.isError
                      ? "Chưa tải được lịch chuyến."
                      : `${activeTrips.length} chuyến đang đón khách hoặc di chuyển`}
                </footer>
              </div>
            </section>
          </div>
          {trips.isError && <ApiFailure error={trips.error} />}
          <p className="live-reports__as-of">
            Cập nhật lúc {displayDate(current.data.dataAsOf)} · Múi giờ Việt Nam
          </p>
        </>
      )}
      {dateOpen && (
        <DateRangeDialog
          range={range}
          onClose={() => setDateOpen(false)}
          onApply={(value) => {
            setRange(value);
            setPeriod(0);
            setDateOpen(false);
          }}
        />
      )}
    </div>
  );
}
