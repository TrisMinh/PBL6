import { useId, useState, type ReactElement } from "react";
import { money } from "./liveReports";
import gridLine from "@/assets/operator/reports/imgLine.svg";

export function LiveRevenueChart({
  series,
}: {
  series: { date: string; revenue: number }[];
}): ReactElement {
  const gradient = useId();
  const [focus, setFocus] = useState<number | null>(null);
  const max = Math.max(...series.map((point) => point.revenue), 1) * 1.2;
  const points = series.map((point, index) => ({
    ...point,
    x: 58 + (index * 774) / Math.max(series.length - 1, 1),
    y: 250 - (point.revenue / max) * 220,
  }));
  const path = points
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const selected = focus === null ? null : points[focus];
  const hasRevenue = series.some((point) => point.revenue > 0);
  return (
    <div className="live-report-chart">
      <svg
        viewBox="0 0 850 310"
        role="img"
        aria-label="Biểu đồ doanh thu gộp theo ngày"
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#83b2fc" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#dce9fd" stopOpacity="0.22" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((index) => (
          <g key={index}>
            <image
              href={gridLine}
              x={58}
              y={30 + index * 55}
              width={774}
              height={1}
            />
            <text x={0} y={34 + index * 55}>
              {hasRevenue ? money(max * (1 - index / 4)) : "0"}
            </text>
          </g>
        ))}
        {path && (
          <>
            <path
              d={`${path} L${points.at(-1)?.x},270 L58,270 Z`}
              fill={`url(#${gradient})`}
            />
            <path d={path} fill="none" stroke="#2277ff" strokeWidth={2} />
          </>
        )}
        {points
          .filter(
            (_, index) =>
              index === 0 ||
              index === points.length - 1 ||
              index % Math.max(1, Math.ceil(points.length / 6)) === 0,
          )
          .map((point) => (
            <text key={point.date} x={point.x} y={297} textAnchor="middle">
              {point.date.slice(8)} / {point.date.slice(5, 7)}
            </text>
          ))}
        {hasRevenue &&
          points.map((point, index) => (
            <circle
              key={point.date}
              cx={point.x}
              cy={point.y}
              r={4}
              fill="white"
              stroke="#2277ff"
              strokeWidth={2}
              tabIndex={0}
              role="button"
              aria-label={`${point.date}: ${money(point.revenue)}`}
              onMouseEnter={() => setFocus(index)}
              onFocus={() => setFocus(index)}
              onClick={() => setFocus(index)}
            />
          ))}
        {selected && (
          <g aria-hidden="true">
            <line
              x1={selected.x}
              x2={selected.x}
              y1={selected.y}
              y2={250}
              stroke="#75879e"
            />
            <g
              transform={`translate(${Math.max(58, Math.min(selected.x - 55, 710))},${Math.max(0, selected.y - 60)})`}
            >
              <rect width={120} height={45} rx={4} fill="#061b33" />
              <text className="live-report-chart__amount" x={12} y={19}>
                {money(selected.revenue)}
              </text>
              <text className="live-report-chart__date" x={12} y={35}>
                {selected.date.split("-").reverse().join("/")}
              </text>
            </g>
          </g>
        )}
      </svg>
      {!hasRevenue && (
        <p className="live-report-chart__empty">
          Chưa có doanh thu trong kỳ này.
        </p>
      )}
    </div>
  );
}
