import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type ReactElement, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { PageState } from "@/shared/ui/PageState/PageState";
import { getOperatorReport } from "./reportsRepository";
import {
  reportFiltersSchema,
  reportPeriodSchema,
  type ReportPeriod,
  type OperatorReport,
  type ReportBooking,
  type ReportVehicle,
} from "./reports.schema";
import navTrips from "@/assets/operator/reports/imgFrame.svg";
import navBookings from "@/assets/operator/reports/imgFrame1.svg";
import navRoutes from "@/assets/operator/reports/imgFrame2.svg";
import navDrivers from "@/assets/operator/reports/imgFrame3.svg";
import navReports from "@/assets/operator/reports/imgFrame4.svg";
import navMembers from "@/assets/operator/reports/imgFrame5.svg";
import navCancel from "@/assets/operator/reports/imgFrame6.svg";
import calendar from "@/assets/operator/reports/imgFrame7.svg";
import chevron from "@/assets/operator/reports/imgFrame8.svg";
import bell from "@/assets/operator/reports/imgFrame9.svg";
import unread from "@/assets/operator/reports/imgUnread.svg";
import ticketsIcon from "@/assets/operator/reports/imgFrame10.svg";
import customerIcon from "@/assets/operator/reports/imgFrame11.svg";
import searchIcon from "@/assets/operator/reports/imgFrame12.svg";
import ticketDate from "@/assets/operator/reports/imgFrame13.svg";
import seatIcon from "@/assets/operator/reports/imgFrame14.svg";
import revenueIcon from "@/assets/operator/reports/imgFrame15.svg";
import costIcon from "@/assets/operator/reports/imgFrame16.svg";
import chartArt from "@/assets/operator/reports/imgRevenueChart.svg";
import gridLine from "@/assets/operator/reports/imgLine.svg";
import tableLine from "@/assets/operator/reports/imgLine1.svg";
import rowLine from "@/assets/operator/reports/imgLine2.svg";
import mapArt from "@/assets/operator/reports/imgMapIllustration.svg";
import mapRoads from "@/assets/operator/reports/imgGroup.svg";
import marker from "@/assets/operator/reports/imgXeAMarker.svg";
import "../schedule/SchedulePage.css";
import "./ReportsPage.css";
const NAV_ICONS: Record<string, string> = {
  "Chuyến đi": navTrips,
  "Đặt chỗ & giao dịch": navBookings,
  "Tuyến & điểm dừng": navRoutes,
  "Xe & sơ đồ ghế": navTrips,
  "Tài xế": navDrivers,
  "Báo cáo": navReports,
  "Tổ chức & thành viên": navMembers,
  "Hủy vé & hoàn tiền": navCancel,
};
const PERIODS: [ReportPeriod, string][] = [
  ["week1", "T1"],
  ["week2", "T2"],
  ["week3", "T3"],
  ["week4", "T4"],
  ["month", "Tháng"],
];
const money = (value: number): string =>
  value >= 1e9
    ? `${(value / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`
    : value >= 1e6
      ? `${(value / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu`
      : `${value.toLocaleString("vi-VN")} đ`;
const dateLabel = (value: string): string =>
  value.split("-").reverse().join("/");
const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
type Detail =
  | { kind: "booking"; item: ReportBooking }
  | { kind: "vehicle"; item: ReportVehicle }
  | { kind: "fleet" }
  | { kind: "notifications" };

function DateRangeForm({
  from,
  to,
  apply,
}: {
  from: string;
  to: string;
  apply: (from: string, to: string) => void;
}): ReactElement {
  const [draftFrom, setFrom] = useState(from),
    [draftTo, setTo] = useState(to),
    [error, setError] = useState("");
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const parsed = reportFiltersSchema.safeParse({
      from: draftFrom,
      to: draftTo,
      period: "month",
    });
    if (!parsed.success) {
      setError("Ngày bắt đầu phải trước ngày kết thúc; tối đa 366 ngày.");
      return;
    }
    apply(draftFrom, draftTo);
  };
  return (
    <form onSubmit={submit} className="operator-reports__range-form">
      <Input
        label="Từ ngày"
        type="date"
        required
        value={draftFrom}
        onChange={(e) => setFrom(e.target.value)}
      />
      <Input
        label="Đến ngày"
        type="date"
        required
        value={draftTo}
        onChange={(e) => setTo(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <footer>
        <Dialog.Close asChild>
          <Button type="button" variant="secondary">
            Hủy
          </Button>
        </Dialog.Close>
        <Button type="submit">Áp dụng</Button>
      </footer>
    </form>
  );
}

function RevenueChart({ report }: { report: OperatorReport }): ReactElement {
  const [focus, setFocus] = useState(report.referenceChart ? 5 : 0);
  const selected = Math.min(focus, report.series.length - 1);
  const max = Math.max(...report.series.map((p) => p.revenue), 1) * 1.2;
  const points = report.series.map((p, index) => ({
    ...p,
    x: report.referenceChart
      ? [0, 82, 164, 246, 328, 410, 492, 574, 656, 774][index]
      : (index * 774) / Math.max(report.series.length - 1, 1),
    y: report.referenceChart
      ? [163, 150, 158, 125, 139, 91, 107, 71, 98, 53][index]
      : 220 - (p.revenue / max) * 220,
  }));
  const point = points[selected];
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const yLabels = report.referenceChart
    ? ["2,0 tỷ", "1,5 tỷ", "1,0 tỷ", "0,5 tỷ", "0"]
    : [money(max), money(max * 0.75), money(max * 0.5), money(max * 0.25), "0"];
  return (
    <div className="operator-reports__chart-scroll">
      <div
        className="operator-reports__chart"
        aria-label="Biểu đồ doanh thu minh họa"
      >
        {yLabels.map((label, i) => (
          <span
            className="operator-reports__axis-y"
            key={i}
            style={{ top: 95 + i * 55 }}
          >
            {label}
          </span>
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <img
            className="operator-reports__grid-line"
            key={i}
            src={gridLine}
            alt=""
            width={774}
            height={1}
            style={{ top: 101 + i * 55 }}
          />
        ))}
        <div className="operator-reports__plot">
          {report.referenceChart ? (
            <img
              src={chartArt}
              alt="Đường doanh thu minh họa tháng 8"
              width={774}
              height={246}
            />
          ) : (
            <svg
              width={774}
              height={246}
              viewBox="0 0 774 246"
              aria-hidden="true"
            >
              <path d={`${path} L774,246 L0,246 Z`} fill="#dce9fd" />
              <path d={path} fill="none" stroke="#2277ff" strokeWidth={2} />
            </svg>
          )}
          {points.map((p, i) => (
            <button
              type="button"
              className="operator-reports__chart-point"
              key={p.date}
              style={{ left: p.x - 10, top: p.y - 10 }}
              aria-label={`${dateLabel(p.date)}: ${money(p.revenue)}, ${p.tickets} vé`}
              onFocus={() => setFocus(i)}
              onMouseEnter={() => setFocus(i)}
              onClick={() => setFocus(i)}
            />
          ))}
          {point && (
            <>
              <div
                className="operator-reports__focus-line"
                style={{ left: point.x }}
              />
              <div
                className="operator-reports__tooltip"
                role="status"
                style={{
                  left: Math.min(666, Math.max(0, point.x - 54)),
                  top: Math.max(0, point.y - 70),
                }}
              >
                <strong>{money(point.revenue)}</strong>
                <small>{point.tickets.toLocaleString("vi-VN")} vé</small>
              </div>
            </>
          )}
        </div>
        {(report.referenceChart
          ? ["01", "05", "10", "15", "20", "25", "31"]
          : Array.from(
              { length: 7 },
              (_, i) =>
                report.series[
                  Math.round((i * (report.series.length - 1)) / 6)
                ]?.date.slice(8) ?? "",
            )
        ).map((label, i) => (
          <span
            key={i}
            className="operator-reports__axis-x"
            style={{ left: 66 + i * 126 }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ReportsPage(): ReactElement {
  const returnFocus = useRef<HTMLElement | null>(null);
  const [params, setParams] = useSearchParams();
  const from = params.get("from") ?? "2026-08-01",
    to = params.get("to") ?? "2026-08-31";
  const period = reportPeriodSchema
    .catch("month")
    .parse(params.get("period") ?? "month");
  const [dateOpen, setDateOpen] = useState(false),
    [detail, setDetail] = useState<Detail | null>(null),
    [search, setSearch] = useState(""),
    [fleetFilter, setFleetFilter] = useState<"all" | "running">("running"),
    [hasUnread, setHasUnread] = useState(true);
  const query = useQuery({
    queryKey: ["operator-report", from, to, period],
    queryFn: ({ signal }) => getOperatorReport(from, to, period, signal),
    retry: false,
  });
  const report = query.data;
  const tickets =
    report?.bookings.filter((b) =>
      normalize(`${b.name} ${b.route} ${b.seats}`).includes(normalize(search)),
    ) ?? [];
  const vehicles =
    report?.vehicles.filter(
      (v) => fleetFilter === "all" || v.status === "running",
    ) ?? [];
  const setPeriod = (value: ReportPeriod): void => {
    setParams((p) => {
      p.set("period", value);
      return p;
    });
  };
  const totals = report?.totals;
  const metrics = totals
    ? [
        [money(totals.revenue), "Doanh thu", "+12,4%", revenueIcon],
        [money(totals.costs), "Chi phí", "−8,0%", costIcon],
        [
          totals.tickets.toLocaleString("vi-VN"),
          "Vé đã bán",
          "+8,2%",
          ticketsIcon,
        ],
        [
          totals.customers.toLocaleString("vi-VN"),
          "Khách hàng",
          "+3,1%",
          customerIcon,
        ],
      ]
    : [];
  return (
    <div className="operator-schedule operator-reports">
      <a className="operator-schedule__skip" href="#operator-reports-main">
        Đến nội dung chính
      </a>
      <OperatorSidebar iconsOverride={NAV_ICONS} />
      <main className="operator-schedule__main" id="operator-reports-main">
        <header className="operator-schedule__header operator-reports__header">
          <div>
            <h1>Báo cáo tổng quan</h1>
            <span>Dữ liệu minh họa</span>
          </div>
          <div className="operator-reports__header-actions">
            <button
              type="button"
              className="operator-reports__dates"
              onClick={() => setDateOpen(true)}
            >
              <img src={calendar} alt="" width={18} height={18} />
              <span>
                {dateLabel(from)} – {dateLabel(to)}
              </span>
              <img src={chevron} alt="" width={14} height={14} />
            </button>
            <button
              type="button"
              className="operator-reports__notifications"
              aria-label="Thông báo"
              onClick={() => {
                setDetail({ kind: "notifications" });
                setHasUnread(false);
              }}
            >
              <img src={bell} alt="" width={18} height={18} />
              {hasUnread && (
                <img
                  className="operator-reports__unread"
                  src={unread}
                  alt="Có thông báo chưa đọc"
                  width={7}
                  height={7}
                />
              )}
            </button>
          </div>
        </header>
        {query.isPending ? (
          <PageState
            title="Đang tải báo cáo"
            description="Vui lòng đợi trong giây lát."
          />
        ) : query.isError ? (
          <PageState
            title="Không tải được báo cáo"
            description={query.error.message}
            action={
              <>
                <Button onClick={() => void query.refetch()}>Thử lại</Button>
                <Button variant="secondary" onClick={() => setDateOpen(true)}>
                  Chọn lại ngày
                </Button>
              </>
            }
          />
        ) : (
          report && (
            <>
              <div className="operator-reports__top">
                <section
                  className="operator-reports__metrics"
                  aria-label="Chỉ số tổng quan"
                >
                  {metrics.map(([value, label, delta, icon]) => (
                    <article key={label} className="operator-reports__metric">
                      <span className="operator-reports__metric-icon">
                        <img src={icon} alt="" width={18} height={18} />
                      </span>
                      <strong>{value}</strong>
                      <p>{label}</p>
                      <span className="operator-reports__delta">
                        {report.series.length ? delta : "0%"}
                      </span>
                      <small>so với tháng trước</small>
                    </article>
                  ))}
                </section>
                <section
                  className="operator-reports__revenue"
                  aria-labelledby="report-revenue-title"
                >
                  <header>
                    <h2 id="report-revenue-title">Doanh thu</h2>
                    <div role="group" aria-label="Kỳ báo cáo">
                      {PERIODS.map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          aria-label={
                            key === "month"
                              ? "Cả tháng"
                              : `Tuần ${key.slice(-1)}`
                          }
                          aria-pressed={period === key}
                          onClick={() => setPeriod(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </header>
                  {report.series.length ? (
                    <RevenueChart
                      key={`${from}-${to}-${period}`}
                      report={report}
                    />
                  ) : (
                    <PageState
                      title="Chưa có doanh thu"
                      description="Không có dữ liệu minh họa trong khoảng ngày đã chọn."
                    />
                  )}
                </section>
              </div>
              <div className="operator-reports__bottom">
                <section
                  className="operator-reports__recent"
                  aria-labelledby="recent-tickets-title"
                >
                  <header>
                    <h2 id="recent-tickets-title">Đặt vé gần đây</h2>
                    <label>
                      <img src={searchIcon} alt="" width={15} height={15} />
                      <input
                        aria-label="Tìm đặt vé"
                        placeholder="Tìm đặt vé"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </header>
                  <img
                    className="operator-reports__table-line"
                    src={tableLine}
                    alt=""
                    width={540}
                    height={1}
                  />
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
                        {tickets.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <button
                                type="button"
                                onClick={() =>
                                  setDetail({ kind: "booking", item: b })
                                }
                              >
                                {b.name}
                              </button>
                              <small>{b.route}</small>
                              <img
                                className="operator-reports__row-line"
                                src={rowLine}
                                alt=""
                                width={500}
                                height={1}
                              />
                            </td>
                            <td>
                              <span>
                                <img
                                  src={ticketDate}
                                  alt=""
                                  width={14}
                                  height={14}
                                />
                                {dateLabel(b.departure).slice(0, 5)} · {b.time}
                              </span>
                            </td>
                            <td>{b.vehicle}</td>
                            <td>
                              <span>
                                <img
                                  src={seatIcon}
                                  alt=""
                                  width={14}
                                  height={14}
                                />
                                {b.seats}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!tickets.length && (
                      <p className="operator-reports__empty">
                        Không có đặt vé phù hợp.
                      </p>
                    )}
                  </div>
                </section>
                <section
                  className="operator-reports__live"
                  aria-labelledby="live-title"
                >
                  <header>
                    <h2 id="live-title">Vị trí xe đang chạy</h2>
                    <div role="group" aria-label="Trạng thái xe">
                      <button
                        type="button"
                        aria-pressed={fleetFilter === "all"}
                        onClick={() => setFleetFilter("all")}
                      >
                        Tất cả
                      </button>
                      <button
                        type="button"
                        aria-pressed={fleetFilter === "running"}
                        onClick={() => setFleetFilter("running")}
                      >
                        Đang chạy
                      </button>
                    </div>
                  </header>
                  <div className="operator-reports__map-scroll">
                    <div
                      className="operator-reports__map"
                      aria-label="Bản đồ vị trí xe minh họa"
                    >
                      <img
                        className="operator-reports__map-art"
                        src={mapArt}
                        alt=""
                        width={622}
                        height={366}
                      />
                      <img
                        className="operator-reports__map-roads"
                        src={mapRoads}
                        alt=""
                        width={674.134}
                        height={381.598}
                      />
                      <span className="operator-reports__map-label operator-reports__map-label--center">
                        Khu trung tâm
                      </span>
                      <span className="operator-reports__map-label operator-reports__map-label--station">
                        Bến xe
                      </span>
                      <span className="operator-reports__map-label operator-reports__map-label--transfer">
                        Điểm trung chuyển
                      </span>
                      {vehicles.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          className="operator-reports__marker"
                          aria-label={`${v.name}, ${v.plate}, ${v.status === "running" ? "đang chạy" : "đang đỗ"}`}
                          style={{ left: v.x, top: v.y }}
                          onClick={() =>
                            setDetail({ kind: "vehicle", item: v })
                          }
                        >
                          <img src={marker} alt="" width={32} height={43} />
                          <span>{v.name}</span>
                        </button>
                      ))}
                      <div className="operator-reports__map-status">
                        <span>
                          {
                            report.vehicles.filter(
                              (v) => v.status === "running",
                            ).length
                          }{" "}
                          xe đang hoạt động
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetail({ kind: "fleet" })}
                        >
                          Xem chi tiết →
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )
        )}
      </main>
      <Dialog.Root open={dateOpen} onOpenChange={setDateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="operator-reports__overlay" />
          <Dialog.Content
            className="operator-reports__dialog"
            onOpenAutoFocus={() => {
              returnFocus.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              returnFocus.current?.focus();
            }}
          >
            <Dialog.Title>Khoảng thời gian báo cáo</Dialog.Title>
            <Dialog.Description>
              Chọn ngày bắt đầu và kết thúc. Dữ liệu minh họa có trong tháng
              8/2026.
            </Dialog.Description>
            <DateRangeForm
              key={`${from}-${to}`}
              from={from}
              to={to}
              apply={(nextFrom, nextTo) => {
                setParams((p) => {
                  p.set("from", nextFrom);
                  p.set("to", nextTo);
                  p.set("period", "month");
                  return p;
                });
                setDateOpen(false);
              }}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="operator-reports__overlay" />
          <Dialog.Content
            className="operator-reports__dialog"
            onOpenAutoFocus={() => {
              returnFocus.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              returnFocus.current?.focus();
            }}
          >
            <Dialog.Title>
              {detail?.kind === "notifications"
                ? "Thông báo"
                : detail?.kind === "booking"
                  ? "Chi tiết đặt vé"
                  : detail?.kind === "vehicle"
                    ? detail.item.name
                    : "Vị trí xe minh họa"}
            </Dialog.Title>
            <Dialog.Description>
              Dữ liệu minh họa của phân hệ Operator.
            </Dialog.Description>
            {detail?.kind === "notifications" && (
              <p>
                Báo cáo tháng 8/2026 đã sẵn sàng. Có 3 xe đang hoạt động trong
                dữ liệu mẫu.
              </p>
            )}
            {detail?.kind === "booking" && (
              <dl>
                {[
                  ["Khách hàng", detail.item.name],
                  ["Tuyến", detail.item.route],
                  [
                    "Khởi hành",
                    `${dateLabel(detail.item.departure)} · ${detail.item.time}`,
                  ],
                  ["Loại xe", detail.item.vehicle],
                  ["Ghế", detail.item.seats],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {detail?.kind === "vehicle" && (
              <div className="operator-reports__vehicle-details">
                <strong>{detail.item.plate}</strong>
                <p>
                  {detail.item.trip} · {detail.item.route}
                </p>
                <p>
                  {detail.item.status === "running" ? "Đang chạy" : "Đang đỗ"}
                </p>
                <Link
                  to={`/operator/vehicles?${new URLSearchParams({ vehicle: detail.item.plate })}`}
                >
                  Xem thông tin xe →
                </Link>
              </div>
            )}
            {detail?.kind === "fleet" && (
              <ul className="operator-reports__fleet-list">
                {vehicles.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setDetail({ kind: "vehicle", item: v })}
                    >
                      {v.name} · {v.plate}
                      <small>{v.route}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <footer>
              <Dialog.Close asChild>
                <Button type="button" variant="secondary">
                  Đóng
                </Button>
              </Dialog.Close>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
