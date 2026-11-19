import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId, useState, type ReactElement } from "react";
import {
  revenueSeries,
  reportBucketUnit,
  sumRevenue,
  type RevenueAmounts,
  type RevenueDay,
  type RevenueRange,
} from "./revenueReport";
import "./RevenueCharts.css";

const compactNumber = new Intl.NumberFormat("vi-VN", { notation: "compact" });
const axisNumber = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const shortDate = (date: string): string =>
  date.slice(5).split("-").reverse().join("/");
const seriesKeys = [
  { key: "grossRevenue", label: "Tiền thu", color: "#2563eb" },
  { key: "netRevenue", label: "Thu ròng", color: "#00816e" },
  { key: "refundAmount", label: "Tiền hoàn", color: "#c65a24" },
] as const;

function runningTotal(
  buckets: ReturnType<typeof revenueSeries>,
): ReturnType<typeof revenueSeries> {
  let collected = 0;
  let refunded = 0;
  const points: ReturnType<typeof revenueSeries> = [];
  for (const bucket of buckets) {
    collected += bucket.grossRevenue;
    refunded += bucket.refundAmount;
    points.push({
      ...bucket,
      grossRevenue: collected,
      refundAmount: refunded,
      netRevenue: collected - refunded,
    });
  }
  return points;
}

export function RevenueLineChart({
  rows,
  range,
  currency,
  annual = false,
  previous,
}: {
  rows: RevenueDay[];
  annual?: boolean;
  previous?: { range: RevenueRange; rows: RevenueDay[] };
  range: RevenueRange;
  currency: string;
}): ReactElement {
  const fillId = useId();
  const [cumulative, setCumulative] = useState(false);
  const unit = annual ? "month" : reportBucketUnit(range);
  const buckets = revenueSeries(rows, range, unit);
  const current = cumulative ? runningTotal(buckets) : buckets;
  const prior = previous
    ? revenueSeries(previous.rows, previous.range, unit)
    : [];
  const previousPoints = cumulative ? runningTotal(prior) : prior;
  const points = current.map((point, index) => ({
    ...point,
    previousNet: previousPoints[index]?.netRevenue,
  }));
  const grouped = buckets.some(({ from, to }) => from !== to);
  const frequency =
    unit === "year"
      ? "Theo năm"
      : unit === "month"
        ? "Theo tháng"
        : grouped
          ? "Theo nhóm ngày"
          : "Theo ngày";
  const labelFor = (date: string) =>
    unit === "year"
      ? date.slice(0, 4)
      : unit === "month"
        ? `${date.slice(5, 7)}/${date.slice(0, 4)}`
        : shortDate(date);
  const totals = sumRevenue(rows);
  const dateLabels = new Map(
    points.map(({ from, to }) => [
      from,
      unit !== "day" || from === to
        ? labelFor(from)
        : `${shortDate(from)}–${shortDate(to)}`,
    ]),
  );
  const peak = Math.max(
    ...points.flatMap((point) => [
      ...seriesKeys.map(({ key }) => Math.abs(point[key])),
      Math.abs(point.previousNet ?? 0),
    ]),
  );
  const scaleUnit = peak >= 1e6 ? 1e6 : peak >= 1e3 ? 1e3 : 1;
  const axisLabel =
    scaleUnit === 1e6 ? "triệu" : scaleUnit === 1e3 ? "nghìn" : undefined;
  const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency });
  return (
    <section
      id="xu-huong"
      className="revenue-report__panel revenue-line"
      aria-labelledby="revenue-line-title"
    >
      <header className="revenue-report__panel-header">
        <div>
          <h2 id="revenue-line-title">Xu hướng doanh thu</h2>
          <p>
            {frequency} · {axisLabel ? `${axisLabel} ` : ""}
            {currency}
          </p>
        </div>
        <div
          className="revenue-line__toggle"
          role="group"
          aria-label="Chế độ xem doanh thu"
        >
          <button
            type="button"
            aria-pressed={!cumulative}
            onClick={() => setCumulative(false)}
          >
            {frequency}
          </button>
          <button
            type="button"
            aria-pressed={cumulative}
            onClick={() => setCumulative(true)}
          >
            Lũy kế
          </button>
        </div>
      </header>
      <dl
        className="revenue-line__values"
        aria-label="Tổng trong khoảng ngày đã chọn"
      >
        {seriesKeys.map(({ key, label, color }) => (
          <div key={key}>
            <dt>
              <span style={{ backgroundColor: color }} />
              {label}
            </dt>
            <dd>{money.format(totals[key])}</dd>
          </div>
        ))}
      </dl>
      {previous && (
        <p className="revenue-report__caption revenue-line__comparison">
          Đường tím chấm: thu ròng cùng kỳ năm trước
        </p>
      )}
      <div className="revenue-line__plot">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={points}
            title="Biểu đồ đường tiền thu, thu ròng và tiền hoàn"
            margin={{ top: 12, right: 14, bottom: 4, left: 0 }}
          >
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#e1e9f4"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="from"
              tickFormatter={labelFor}
              minTickGap={24}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[
                (min: number) => Math.min(min, 0),
                (max: number) => Math.max(max, 0),
              ]}
              width={52}
              tickFormatter={(value: number) =>
                axisNumber.format(value / scaleUnit)
              }
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Tooltip
              labelFormatter={(label) =>
                dateLabels.get(String(label)) ?? shortDate(String(label))
              }
              formatter={(value) => money.format(Number(value))}
              contentStyle={{
                borderRadius: 12,
                borderColor: "#dce6f1",
                boxShadow: "0 8px 24px #132e5220",
              }}
            />
            <Area
              dataKey="netRevenue"
              fill={`url(#${fillId})`}
              stroke="none"
              baseValue={0}
              tooltipType="none"
              isAnimationActive="auto"
              animationDuration={600}
              animationEasing="ease-out"
            />
            {seriesKeys.map(({ key, label, color }) => (
              <Line
                key={key}
                dataKey={key}
                name={label}
                stroke={color}
                strokeWidth={key === "netRevenue" ? 3 : 2}
                strokeDasharray={key === "refundAmount" ? "5 4" : undefined}
                dot={points.length === 1}
                activeDot={{ r: 5 }}
                isAnimationActive="auto"
                animationDuration={600}
                animationEasing="ease-out"
              />
            ))}
            {previous && (
              <Line
                dataKey="previousNet"
                name="Thu ròng cùng kỳ năm trước"
                stroke="#7654bd"
                strokeDasharray="2 5"
                strokeWidth={2}
                dot={points.length === 1}
                isAnimationActive="auto"
                animationDuration={600}
                animationEasing="ease-out"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function SettlementWaterfall({
  totals,
  currency,
}: {
  totals: RevenueAmounts;
  currency: string;
}): ReactElement {
  const afterCommission = totals.netRevenue - totals.platformCommission;
  const steps = [
    {
      label: "Tiền thu",
      from: 0,
      to: totals.grossRevenue,
      tone: "blue",
      total: true,
    },
    {
      label: "Tiền hoàn",
      from: totals.grossRevenue,
      to: totals.netRevenue,
      tone: "orange",
    },
    {
      label: "Thu ròng",
      from: 0,
      to: totals.netRevenue,
      tone: "green",
      total: true,
    },
    {
      label: "Hoa hồng",
      from: totals.netRevenue,
      to: afterCommission,
      tone: "violet",
    },
    {
      label: "Chênh lệch",
      from: afterCommission,
      to: totals.operatorPayable,
      tone: "orange",
    },
    {
      label: "Phải trả",
      from: 0,
      to: totals.operatorPayable,
      tone: "blue",
      total: true,
    },
  ];
  const colors = {
    blue: "#2563eb",
    orange: "#d46d31",
    green: "#00816e",
    violet: "#7853d3",
  };
  const data = steps.map(({ label, from, to, tone, total }) => ({
    label,
    interval: [Math.min(from, to), Math.max(from, to)],
    amount: total ? to : to - from,
    fill: colors[tone as keyof typeof colors],
  }));
  const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency });
  return (
    <section
      className="revenue-report__panel settlement-waterfall"
      aria-labelledby="settlement-waterfall-title"
    >
      <header className="revenue-report__panel-header">
        <div>
          <h2 id="settlement-waterfall-title">Từ tiền thu đến phải trả</h2>
          <p>Đơn vị tiền {currency}</p>
        </div>
      </header>
      <ResponsiveContainer width="100%" height={238}>
        <BarChart
          data={data}
          layout="vertical"
          title="Thác nước đối soát"
          margin={{ top: 8, bottom: 0, left: 0, right: 14 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke="#e1e9f4"
            strokeDasharray="4 4"
          />
          <YAxis
            type="category"
            dataKey="label"
            width={82}
            tickLine={false}
            axisLine={false}
          />
          <XAxis
            type="number"
            tickFormatter={(value: number) => compactNumber.format(value)}
            tickLine={false}
            axisLine={false}
          />
          <ReferenceLine x={0} stroke="#94a3b8" />
          <Tooltip
            cursor={{ fill: "#e9effa" }}
            contentStyle={{ borderRadius: 12, borderColor: "#dce6f1" }}
            formatter={(_value, _name, item) => [
              money.format(item.payload.amount),
              "Số tiền",
            ]}
          />
          <Bar
            dataKey="interval"
            barSize={15}
            radius={4}
            isAnimationActive="auto"
            animationDuration={600}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
