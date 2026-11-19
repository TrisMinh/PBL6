import {
  Bar as ChartBar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { ApiError } from "@/shared/api/error";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { Button } from "@/shared/ui/Button/Button";
import {
  reportBuckets,
  reportBucketUnit,
  type RevenueRange,
} from "./revenueReport";
import "./OperatorBookingAnalytics.css";
import {
  BookingReportOrders,
  type BookingOrderFilters,
} from "./BookingReportOrders";

const count = z.int().nonnegative();
const channelSchema = z.enum(["PREPAID", "PAY_LATER"]);
const schema = z.object({
  totals: z.object({
    bookings: count,
    confirmed: count,
    customers: count,
    trips: count,
    tickets: count,
    boarded: count,
  }),
  daily: z.array(
    z.object({
      date: z.iso.date(),
      bookings: count,
      tickets: count,
      boarded: count,
    }),
  ),
  routes: z.array(z.object({ id: z.guid(), name: z.string() })),
  matrix: z.array(
    z.object({
      date: z.iso.date(),
      routeId: z.guid(),
      name: z.string(),
      channel: channelSchema,
      bookings: count,
      tickets: count,
      boarded: count,
    }),
  ),
  statuses: z.array(z.object({ status: z.string(), bookings: count })),
});
const number = new Intl.NumberFormat("vi-VN");
const percent = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 1,
});
const channelLabels = { PREPAID: "Trả trước", PAY_LATER: "Trả tại nhà xe" };
const statusLabels: Readonly<Record<string, string>> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  CONFIRMED: "Đã xác nhận",
  PAID: "Đã thanh toán",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
  REFUND_PENDING: "Chờ hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
};
const shortDate = (date: string): string =>
  date.slice(5).split("-").reverse().join("/");

function TicketMatrix({
  range,
  matrix,
}: {
  range: RevenueRange;
  matrix: z.infer<typeof schema>["matrix"];
}): ReactElement {
  const buckets = reportBuckets(range, 10);
  const unit = reportBucketUnit(range);
  const grouped = new Map<
    string,
    { label: string; channel: keyof typeof channelLabels; counts: number[] }
  >();
  for (const row of matrix) {
    const key = `${row.routeId}/${row.channel}`;
    const current = grouped.get(key) ?? {
      label: row.name,
      channel: row.channel,
      counts: buckets.map(() => 0),
    };
    const index = buckets.findIndex(
      ({ from, to }) => row.date >= from && row.date <= to,
    );
    if (index >= 0) current.counts[index] += row.tickets;
    grouped.set(key, current);
  }
  const rows = [...grouped.entries()].sort(
    ([, a], [, b]) =>
      a.label.localeCompare(b.label, "vi") ||
      a.channel.localeCompare(b.channel),
  );
  const peak = rows.reduce((max, [, row]) => Math.max(max, ...row.counts), 1);
  return (
    <section
      className="revenue-report__panel"
      aria-labelledby="booking-matrix-title"
    >
      <h3 id="booking-matrix-title">Số vé theo ngày và tuyến</h3>
      <p className="revenue-report__caption">
        Ô càng đậm thì càng có nhiều vé hợp lệ.
      </p>
      <div
        className="revenue-report__table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Bảng vé theo ngày, tuyến và cách thanh toán"
      >
        <table className="booking-analytics__matrix">
          <thead>
            <tr>
              <th scope="col">Tuyến</th>
              <th scope="col">Kênh</th>
              {buckets.map(({ from, to }) => (
                <th scope="col" key={from}>
                  {unit === "year"
                    ? from.slice(0, 4)
                    : unit === "month"
                      ? `${from.slice(5, 7)}/${from.slice(0, 4)}`
                      : from === to
                        ? shortDate(from)
                        : `${shortDate(from)}–${shortDate(to)}`}
                </th>
              ))}
              <th scope="col">Tổng vé</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, row]) => (
              <tr key={key}>
                <th scope="row">{row.label}</th>
                <td>{channelLabels[row.channel]}</td>
                {row.counts.map((value, index) => (
                  <td
                    key={buckets[index].from}
                    data-intensity={Math.ceil((value / peak) * 4)}
                  >
                    {number.format(value)}
                  </td>
                ))}
                <td>
                  <strong>
                    {number.format(
                      row.counts.reduce((sum, value) => sum + value, 0),
                    )}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                Tổng vé
              </th>
              {buckets.map(({ from }, index) => (
                <td key={from}>
                  {number.format(
                    rows.reduce((sum, [, row]) => sum + row.counts[index], 0),
                  )}
                </td>
              ))}
              <td>
                {number.format(
                  matrix.reduce((sum, item) => sum + item.tickets, 0),
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

interface Bar {
  key: string;
  label: string;
  value: number;
  secondary?: number;
  click?: () => void;
  tone?: string;
}

function ChannelMix({ items }: { items: Bar[] }): ReactElement {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const segments = items.map((item, index) => ({
    name: item.label,
    value: item.value,
    fill: index === 0 ? "#7148cf" : "#07958d",
  }));
  return (
    <div className="booking-analytics__channel-mix">
      <div className="booking-analytics__donut" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total ? segments : [{ value: 1, fill: "#e4ebf5" }]}
              dataKey="value"
              innerRadius="72%"
              outerRadius="100%"
              stroke="none"
              paddingAngle={total ? 3 : 0}
              cornerRadius={5}
              isAnimationActive="auto"
              animationDuration={540}
              animationEasing="ease-out"
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="booking-analytics__donut-total">
          <strong>{number.format(total)}</strong>
          <span>đơn đặt</span>
        </div>
      </div>
      <ul className="booking-analytics__mix-legend">
        {items.map((item, index) => (
          <li key={item.key}>
            <button type="button" onClick={item.click}>
              <span data-channel={index === 0 ? "prepaid" : "pay-later"} />
              {item.label}
            </button>
            <strong>{number.format(item.value)} đơn</strong>
            <small>{percent.format(total ? item.value / total : 0)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bars({
  items,
  unit,
  legend,
}: {
  items: Bar[];
  unit: string;
  legend?: readonly [string, string];
}): ReactElement {
  const maximum = Math.max(
    1,
    ...items.map((item) => item.value + (item.secondary ?? 0)),
  );
  return (
    <>
      {legend && (
        <p className="booking-analytics__legend">
          <span>{legend[0]}</span>
          <span>{legend[1]}</span>
        </p>
      )}
      <ul className="booking-analytics__bars">
        {items.map(({ key, label, value, secondary = 0, click, tone }) => (
          <li key={key}>
            <div className="booking-analytics__bar-label">
              {click ? (
                <button type="button" onClick={click}>
                  {label}
                </button>
              ) : (
                <span>{label}</span>
              )}
              <strong>
                {number.format(value + secondary)} {unit}
              </strong>
            </div>
            <div
              className="booking-analytics__bar"
              aria-hidden="true"
              title={
                legend
                  ? `${legend[0]} ${value} · ${legend[1]} ${secondary}`
                  : undefined
              }
            >
              <span
                data-tone={tone}
                style={{ width: `${(value / maximum) * 100}%` }}
              />
              <span style={{ width: `${(secondary / maximum) * 100}%` }} />
            </div>
            {legend && (
              <span className="booking-analytics__bar-detail">
                {legend[0]} {number.format(value)} · {legend[1]}{" "}
                {number.format(secondary)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function TicketTrend({
  range,
  daily,
}: {
  range: RevenueRange;
  daily: z.infer<typeof schema>["daily"];
}): ReactElement {
  const unit = reportBucketUnit(range);
  const tick = (date: string) =>
    unit === "year"
      ? date.slice(0, 4)
      : unit === "month"
        ? `${date.slice(5, 7)}/${date.slice(0, 4)}`
        : shortDate(date);
  const groups = reportBuckets(range).map(({ from: start, to: end }) => {
    const rows = daily.filter((row) => row.date >= start && row.date <= end);
    return {
      start,
      end,
      tickets: rows.reduce((sum, row) => sum + row.tickets, 0),
      boarded: rows.reduce((sum, row) => sum + row.boarded, 0),
    };
  });
  return (
    <figure className="booking-analytics__trend">
      <figcaption className="booking-analytics__legend">
        <span>Vé hợp lệ</span>
        <span>Vé đã check-in</span>
      </figcaption>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart
          data={groups}
          title="Vé hợp lệ và vé đã check-in theo ngày đặt"
          margin={{ top: 8, left: 0, right: 8, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="#e1e9f4"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="start"
            tickFormatter={tick}
            axisLine={false}
            tickLine={false}
            minTickGap={18}
          />
          <YAxis
            width={36}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "#e9effa" }}
            contentStyle={{ borderRadius: 12, borderColor: "#dce6f1" }}
            labelFormatter={(label, payload) => {
              const start = String(label);
              const end = payload[0]?.payload.end;
              return unit === "day" && end && end !== start
                ? `${shortDate(start)}–${shortDate(end)}`
                : tick(start);
            }}
            formatter={(value) => number.format(Number(value))}
          />
          <ChartBar
            dataKey="tickets"
            name="Vé hợp lệ"
            fill="#2563eb"
            radius={[5, 5, 0, 0]}
            maxBarSize={30}
            isAnimationActive="auto"
            animationDuration={540}
            animationEasing="ease-out"
          />
          <ChartBar
            dataKey="boarded"
            name="Vé đã check-in"
            fill="#07958d"
            radius={[5, 5, 0, 0]}
            maxBarSize={30}
            isAnimationActive="auto"
            animationDuration={540}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
      <details>
        <summary>Xem số liệu theo ngày</summary>
        <div className="revenue-report__table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Ngày đặt</th>
                <th scope="col">Đơn</th>
                <th scope="col">Vé hợp lệ</th>
                <th scope="col">Vé đã check-in</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((item) => (
                <tr key={item.date}>
                  <th scope="row">{shortDate(item.date)}</th>
                  <td>{number.format(item.bookings)}</td>
                  <td>{number.format(item.tickets)}</td>
                  <td>{number.format(item.boarded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function OperatorBookingAnalytics({
  range,
  enabled,
  dateControls,
  allTime,
}: {
  range: RevenueRange;
  enabled: boolean;
  dateControls: ReactElement;
  allTime: boolean;
}): ReactElement {
  const [orders, setOrders] = useState<BookingOrderFilters>();
  const [params, setParams] = useSearchParams();
  const route = z.guid().safeParse(params.get("route"));
  const channel = channelSchema.safeParse(params.get("channel"));
  const routeId = route.success ? route.data : "";
  const paymentChannel = channel.success ? channel.data : "";
  function openOrders(filters: BookingOrderFilters = {}): void {
    setOrders({ routeId, channel: paymentChannel, ...filters });
  }
  const query = useQuery({
    queryKey: liveQueryKey(
      "operator-booking-analytics",
      range.from,
      range.to,
      routeId,
      paymentChannel,
      allTime,
    ),
    queryFn: ({ signal }) => {
      const filter = new URLSearchParams({ from: range.from, to: range.to });
      if (allTime) filter.set("allTime", "true");
      if (routeId) filter.set("routeId", routeId);
      if (paymentChannel) filter.set("channel", paymentChannel);
      return apiJson(`/api/v1/operator/bookings/analytics?${filter}`, schema, {
        signal,
      });
    },
    enabled,
    retry: false,
  });
  function select(key: "route" | "channel", value: string): void {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { preventScrollReset: true },
    );
  }
  const data = query.data;
  const displayRange =
    allTime && data?.daily[0]
      ? { from: data.daily[0].date, to: range.to }
      : range;
  const byRoute = new Map<
    string,
    { name: string; prepaid: number; payLater: number }
  >();
  for (const row of data?.matrix ?? []) {
    const current = byRoute.get(row.routeId) ?? {
      name: row.name,
      prepaid: 0,
      payLater: 0,
    };
    if (row.channel === "PREPAID") current.prepaid += row.tickets;
    else current.payLater += row.tickets;
    byRoute.set(row.routeId, current);
  }
  const routeBars = [...byRoute.entries()]
    .filter(([, item]) => item.prepaid + item.payLater > 0)
    .sort(([, a], [, b]) => b.prepaid + b.payLater - a.prepaid - a.payLater)
    .slice(0, 8)
    .map(([id, item]) => ({
      key: id,
      label: item.name,
      value: item.prepaid,
      secondary: item.payLater,
      click: () => select("route", id === routeId ? "" : id),
    }));
  const channels = Object.entries(channelLabels).map(([key, label]) => ({
    key,
    label,
    value: (data?.matrix ?? [])
      .filter((item) => item.channel === key)
      .reduce((sum, item) => sum + item.bookings, 0),
    click: () => openOrders({ channel: key }),
  }));
  const accessDenied =
    query.error instanceof ApiError && [401, 403].includes(query.error.status);
  return (
    <section
      id="van-hanh"
      className="booking-analytics"
      aria-label="Khách, đơn và vé"
    >
      <section
        className="revenue-report__panel revenue-report__filters booking-analytics__toolbar"
        aria-label="Bộ lọc báo cáo"
      >
        {dateControls}
        <label className="booking-analytics__route">
          Tuyến
          <select
            value={routeId}
            onChange={(event) => select("route", event.target.value)}
          >
            <option value="">Tất cả tuyến</option>
            {routeId && !data?.routes.some((item) => item.id === routeId) && (
              <option value={routeId}>Tuyến đang lọc</option>
            )}
            {data?.routes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="booking-analytics__payment">
          Cách thanh toán
          <select
            value={paymentChannel}
            onChange={(event) => select("channel", event.target.value)}
          >
            <option value="">Tất cả</option>
            {Object.entries(channelLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>
      {query.isPending && (
        <p className="revenue-report__state" role="status">
          Đang tải số liệu đặt vé…
        </p>
      )}
      {query.isError && (
        <div className="revenue-report__state" role="alert">
          <p>
            {accessDenied
              ? "Tài khoản chưa có quyền xem số liệu của nhà xe."
              : "Chưa tải được số liệu đặt vé."}
          </p>
          {!accessDenied && (
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          )}
        </div>
      )}
      {data && (
        <>
          <dl className="booking-analytics__metrics">
            {(
              [
                [
                  "Khách đặt vé",
                  data.totals.customers,
                  "Mỗi tài khoản có vé hợp lệ được tính một lần",
                ],
                [
                  "Đơn đặt vé",
                  data.totals.bookings,
                  `${number.format(data.totals.confirmed)} đơn đã xác nhận`,
                ],
                [
                  "Vé hợp lệ",
                  data.totals.tickets,
                  `${number.format(data.totals.trips)} chuyến có vé`,
                ],
                [
                  "Vé đã check-in",
                  data.totals.boarded,
                  data.totals.tickets
                    ? `${percent.format(data.totals.boarded / data.totals.tickets)} trên vé hợp lệ`
                    : "Chưa có vé hợp lệ",
                ],
              ] as const
            ).map(([label, value, detail], index) => (
              <div
                className="revenue-report__metric"
                data-metric={
                  ["customers", "bookings", "tickets", "check-in"][index]
                }
                key={label}
              >
                <dt>{label}</dt>
                <dd>{number.format(value)}</dd>
                {index > 0 && (
                  <button
                    className="booking-analytics__drill"
                    type="button"
                    aria-label={`Xem đơn · ${label}`}
                    onClick={() =>
                      openOrders(
                        index === 2
                          ? { tickets: "valid" }
                          : index === 3
                            ? { tickets: "checked-in" }
                            : {},
                      )
                    }
                  >
                    Xem đơn
                  </button>
                )}
                <small>{detail}</small>
              </div>
            ))}
          </dl>
          {data.totals.bookings === 0 ? (
            <p className="revenue-report__state">
              Không có đơn đặt vé nào khớp với bộ lọc.
            </p>
          ) : (
            <>
              <div className="booking-analytics__charts">
                <section className="revenue-report__panel">
                  <h3>Vé và check-in theo ngày đặt</h3>
                  <TicketTrend range={displayRange} daily={data.daily} />
                </section>
                <section className="revenue-report__panel">
                  <header className="booking-analytics__chart-heading">
                    <h3>Vé theo tuyến và cách thanh toán</h3>
                    <button
                      className="booking-analytics__drill"
                      type="button"
                      onClick={() => openOrders({ tickets: "valid" })}
                    >
                      Xem đơn có vé
                    </button>
                  </header>
                  {routeBars.length ? (
                    <Bars
                      items={routeBars}
                      unit="vé"
                      legend={[channelLabels.PREPAID, channelLabels.PAY_LATER]}
                    />
                  ) : (
                    <p className="revenue-report__caption">
                      Chưa có vé hợp lệ trong khoảng này.
                    </p>
                  )}
                </section>
                <section className="revenue-report__panel">
                  <header className="booking-analytics__chart-heading">
                    <h3>Đơn theo trạng thái</h3>
                    <button
                      className="booking-analytics__drill"
                      type="button"
                      onClick={() => openOrders()}
                    >
                      Xem danh sách
                    </button>
                  </header>
                  <Bars
                    items={data.statuses.map((item) => ({
                      key: item.status,
                      label: statusLabels[item.status] ?? item.status,
                      value: item.bookings,
                      tone: item.status,
                      click: () => openOrders({ status: item.status }),
                    }))}
                    unit="đơn"
                  />
                </section>
                <section className="revenue-report__panel">
                  <h3>Đơn theo cách thanh toán</h3>
                  <ChannelMix items={channels} />
                </section>
              </div>
              <TicketMatrix range={displayRange} matrix={data.matrix} />
            </>
          )}
          <details className="booking-analytics__metric-note">
            <summary>Số vé đã check-in lấy từ đâu?</summary>
            <p>
              Chỉ tính các vé đặt trong khoảng ngày đã chọn và đã check-in hoặc
              đã sử dụng. Bạn có thể kiểm tra cột CHECK-IN trong danh sách khách
              của từng chuyến.
              <br />
              <Link to="/operator/bookings/trips">Xem danh sách chuyến</Link>
            </p>
          </details>
        </>
      )}
      {orders && (
        <BookingReportOrders
          initial={orders}
          range={range}
          allTime={allTime}
          routes={data?.routes ?? []}
          statuses={statusLabels}
          channels={channelLabels}
          close={() => setOrders(undefined)}
        />
      )}
    </section>
  );
}
