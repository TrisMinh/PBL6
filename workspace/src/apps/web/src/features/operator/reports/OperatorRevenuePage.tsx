import { useQuery } from "@tanstack/react-query";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { ApiError } from "@/shared/api/error";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { Button } from "@/shared/ui/Button/Button";
import { operatorDefaultRange } from "../operatorDates";
import { previousRange, shiftDate } from "./liveReports";
import {
  fetchRevenue,
  priorCalendarYear,
  revenueColumns,
  revenueCsv,
  revenueRangeSchema,
  revenueTimezone,
  sumRevenue,
  type RevenueAmounts,
  type RevenueDay,
  type RevenueRange,
} from "./revenueReport";
import "./OperatorRevenuePage.css";
import { OperatorBookingAnalytics } from "./OperatorBookingAnalytics";
import { RevenueLineChart, SettlementWaterfall } from "./RevenueCharts";

const number = new Intl.NumberFormat("vi-VN");
const formatDate = (date: string): string =>
  date.split("-").reverse().join("/");
const ratio = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const timestamp = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: revenueTimezone,
});

function FinanceCharts({
  totals,
  previous,
  comparisonLabel,
  currency,
}: {
  totals: RevenueAmounts;
  previous?: RevenueAmounts;
  comparisonLabel: string;
  currency: string;
}): ReactElement {
  const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency });
  const entries = revenueColumns.slice(0, 3);
  const scale = Math.max(
    1,
    ...entries.flatMap(([key]) => [
      Math.abs(totals[key]),
      Math.abs(previous?.[key] ?? 0),
    ]),
  );
  return (
    <div className="revenue-report__finance-charts">
      <section className="revenue-report__panel">
        <h2>
          {previous
            ? `So với ${comparisonLabel.toLowerCase()}`
            : "Tổng dòng tiền"}
        </h2>
        {previous && (
          <p className="booking-analytics__legend">
            <span>Kỳ này</span>
            <span>{comparisonLabel}</span>
          </p>
        )}
        <ul className="booking-analytics__bars">
          {entries.map(([key, label]) => (
            <li key={key}>
              <div className="booking-analytics__bar-label">
                <span>{label}</span>
                <strong>{money.format(totals[key])}</strong>
              </div>
              <div className="booking-analytics__bar" aria-hidden="true">
                <span
                  data-negative={totals[key] < 0}
                  style={{
                    width: `${(Math.abs(totals[key]) / scale) * 100}%`,
                  }}
                />
              </div>
              {previous && (
                <>
                  <div
                    className="booking-analytics__bar booking-analytics__bar--previous"
                    aria-hidden="true"
                  >
                    <span
                      data-negative={previous[key] < 0}
                      style={{
                        width: `${(Math.abs(previous[key]) / scale) * 100}%`,
                      }}
                    />
                  </div>
                  <small className="booking-analytics__bar-detail">
                    {comparisonLabel} {money.format(previous[key])}
                  </small>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
      <SettlementWaterfall totals={totals} currency={currency} />
    </div>
  );
}

function powerBIUrl(): string | undefined {
  const configured = import.meta.env.VITE_OPERATOR_POWER_BI_EMBED_URL;
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    if (
      url.origin === "https://app.powerbi.com" &&
      url.pathname === "/reportEmbed" &&
      url.searchParams.has("reportId")
    ) {
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function PowerBI({ active }: { active: boolean }): ReactElement {
  const [opened, setOpened] = useState(false);
  const [fullscreenFailed, setFullscreenFailed] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const url = powerBIUrl();

  async function openFullscreen(): Promise<void> {
    setFullscreenFailed(false);
    try {
      if (!frame.current?.requestFullscreen)
        throw new Error("Fullscreen unavailable");
      await frame.current.requestFullscreen();
    } catch {
      setFullscreenFailed(true);
    }
  }

  return (
    <section
      id="power-bi"
      hidden={!active}
      className="revenue-report__power"
      aria-labelledby="operator-power-bi"
    >
      <header className="revenue-report__panel revenue-report__power-header">
        <div>
          <h2 id="operator-power-bi">Báo cáo Power BI</h2>
          <p>
            Chọn trang Vận hành hoặc Tài chính trong báo cáo. Dùng bộ lọc ngay
            trên từng trang để xem số liệu cần tìm.
          </p>
        </div>
        {url && (
          <div className="revenue-report__power-actions">
            {opened ? (
              <Button variant="secondary" onClick={() => void openFullscreen()}>
                Toàn màn hình
              </Button>
            ) : (
              <Button onClick={() => setOpened(true)}>
                Xem báo cáo tại đây
              </Button>
            )}
            <a
              className="button button--secondary"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Mở trong tab mới
            </a>
          </div>
        )}
      </header>
      {fullscreenFailed && (
        <p className="revenue-report__caption" role="status">
          Không mở được toàn màn hình. Bạn có thể mở báo cáo trong tab mới.
        </p>
      )}
      {url && opened && (
        <div className="revenue-report__power-frame" ref={frame}>
          <iframe
            title="Power BI báo cáo nhà xe"
            src={url}
            loading="lazy"
            allowFullScreen
          />
        </div>
      )}
      {!url && (
        <p className="revenue-report__caption">
          Chưa có báo cáo nhúng. Bạn có thể mở báo cáo mẫu bằng Power BI
          Desktop.
        </p>
      )}
      <details className="revenue-report__power-downloads">
        <summary>Tệp mẫu và dự án Power BI</summary>
        <div className="revenue-report__power-links">
          <a href="/analytics/operator-dashboard-demo.pbix" download>
            Tải báo cáo mẫu (.pbix)
          </a>
          <a href="/analytics/operator-dashboard.zip" download>
            Tải dự án có chi tiết đơn hàng (.zip)
          </a>
        </div>
      </details>
    </section>
  );
}

function DateFilters({
  range,
  apply,
}: {
  range: RevenueRange;
  apply: (range: RevenueRange) => void;
}): ReactElement {
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [showError, setShowError] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = revenueRangeSchema.safeParse({ from, to });
    if (result.success) apply(result.data);
    setShowError(!result.success);
  }
  return (
    <form className="revenue-report__dates" onSubmit={submit}>
      <label>
        Từ ngày
        <input
          type="date"
          required
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </label>
      <label>
        Đến ngày
        <input
          type="date"
          required
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </label>
      <Button type="submit">Áp dụng</Button>
      {showError && (
        <p className="revenue-report__form-error" role="alert">
          Chọn ngày kết thúc từ ngày bắt đầu trở đi, tối đa 366 ngày.
        </p>
      )}
    </form>
  );
}

function download(
  rows: RevenueDay[],
  range: RevenueRange,
  currency: string,
): void {
  const url = URL.createObjectURL(
    new Blob([revenueCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `doanh-thu-${range.from}-${range.to}-${currency}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const reportTabs = [
  { id: "xu-huong", label: "Xu hướng doanh thu" },
  { id: "van-hanh", label: "Khách, đơn và vé" },
  { id: "tai-chinh", label: "Doanh thu và đối soát" },
  { id: "power-bi", label: "Power BI" },
] as const;

export function OperatorRevenuePage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const tabParam = params.get("tab");
  const legacyTab = reportTabs.find(({ id }) => hash === `#${id}`);
  const tab =
    reportTabs.find(({ id }) => id === tabParam) ?? legacyTab ?? reportTabs[0];
  const finance = tab.id === "xu-huong" || tab.id === "tai-chinh";

  useEffect(() => {
    if (tabParam || !legacyTab) return;
    setParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        updated.set("tab", legacyTab.id);
        return updated;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [legacyTab, setParams, tabParam]);

  const { isHydrated, session } = useAccountSession();
  const today = operatorDefaultRange("reports").to;
  const monthToDate = { from: `${today.slice(0, 7)}-01`, to: today };
  const parsed = revenueRangeSchema.safeParse({
    from: params.get("from"),
    to: params.get("to"),
  });
  const mode = params.get("period");
  const allTime = mode === "all";
  const annual = mode === "year" || mode === "previous-year";
  const year = Number(today.slice(0, 4));
  const allTimeRange = { from: `${year}-01-01`, to: today };
  const presets = [
    { id: "month", label: "Tháng này", range: monthToDate },
    {
      id: "week",
      label: "7 ngày qua",
      range: { from: shiftDate(today, -6), to: today },
    },
    {
      id: "month-back",
      label: "30 ngày qua",
      range: { from: shiftDate(today, -29), to: today },
    },
    { id: "year", label: "Năm nay", range: allTimeRange },
    {
      id: "previous-year",
      label: "Năm trước",
      range: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
    },
    { id: "all", label: "Toàn bộ thời gian", range: allTimeRange },
  ];
  const selectedMode = presets.find(({ id }) => id === mode);
  const range =
    (annual || allTime) && selectedMode
      ? selectedMode.range
      : parsed.success
        ? parsed.data
        : monthToDate;
  const preset =
    selectedMode ??
    presets
      .slice(0, 3)
      .find(
        ({ range: option }) =>
          option.from === range.from && option.to === range.to,
      );
  const comparison = annual ? priorCalendarYear(range) : previousRange(range);
  const enabled = isHydrated && Boolean(session);
  const current = useQuery({
    queryKey: liveQueryKey("operator-revenue", range.from, range.to, allTime),
    queryFn: ({ signal }) => fetchRevenue(range, signal, allTime),
    enabled: enabled && finance,
    retry: false,
  });
  const prior = useQuery({
    queryKey: liveQueryKey("operator-revenue", comparison.from, comparison.to, false),
    queryFn: ({ signal }) => fetchRevenue(comparison, signal),
    enabled: enabled && finance && !allTime,
    retry: false,
  });
  const comparisonReady = !allTime && prior.isSuccess;
  const currencies = [
    ...new Set(
      [
        ...(current.data?.data ?? []),
        ...(comparisonReady ? (prior.data?.data ?? []) : []),
      ].map((row) => row.currency),
    ),
  ].sort();
  const requested = params.get("currency");
  const currency =
    currencies.find((code) => code === requested) ??
    currencies.find((code) => code === "VND") ??
    currencies[0] ??
    "VND";
  const rows =
    current.data?.data.filter((row) => row.currency === currency) ?? [];
  const displayRange =
    allTime && rows.length > 0
      ? { from: rows[0].periodDate, to: range.to }
      : range;
  const comparisonLabel = annual ? "Cùng kỳ năm trước" : "Kỳ trước";
  const mostRecent = rows.reduce(
    (latest, row) => Math.max(latest, Date.parse(row.dataAsOf)),
    0,
  );
  const totals = sumRevenue(rows);
  const priorRows =
    prior.data?.data.filter((row) => row.currency === currency) ?? [];
  const priorTotals = sumRevenue(priorRows);
  const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency });
  const apply = (next: RevenueRange, period?: string): void =>
    setParams((previous) => {
      const updated = new URLSearchParams(previous);
      if (period) updated.set("period", period);
      else updated.delete("period");
      updated.set("from", next.from);
      updated.set("to", next.to);
      return updated;
    });
  const noAccess =
    current.error instanceof ApiError &&
    [401, 403].includes(current.error.status);
  const dateControls = (
    <>
      <label className="revenue-report__period">
        Khoảng ngày
        <select
          value={preset?.id ?? ""}
          onChange={(event) => {
            const next = presets.find(({ id }) => id === event.target.value);
            if (next) apply(next.range, next.id);
          }}
        >
          <option value="" disabled>
            Tùy chọn
          </option>
          {presets.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {!allTime && (
        <DateFilters
          key={`${range.from}/${range.to}`}
          range={range}
          apply={apply}
        />
      )}
    </>
  );
  return (
    <div className="revenue-report">
      <header className="revenue-report__heading">
        <div>
          <h1>Báo cáo nhà xe</h1>

          {import.meta.env.VITE_OPERATOR_REPORT_DEMO === "true" && (
            <span className="revenue-report__demo">Dữ liệu minh họa</span>
          )}
        </div>
        {finance && (
          <div className="revenue-report__actions">
            <Button
              variant="secondary"
              disabled={current.isFetching || !enabled || noAccess}
              onClick={() => {
                void current.refetch();
                if (current.isSuccess && !allTime) void prior.refetch();
              }}
            >
              {current.isFetching && !current.isPending
                ? "Đang làm mới…"
                : "Làm mới"}
            </Button>
            <Button
              variant="secondary"
              disabled={!rows.length || current.isError}
              onClick={() => download(rows, displayRange, currency)}
            >
              Xuất CSV
            </Button>
          </div>
        )}
      </header>
      <nav className="revenue-report__tabs" aria-label="Nội dung báo cáo">
        {reportTabs.map(({ id, label }) => {
          const next = new URLSearchParams(params);
          next.set("tab", id);
          return (
            <Link
              key={id}
              to={{ search: `?${next}` }}
              aria-current={tab.id === id ? "page" : undefined}
              preventScrollReset
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {finance && (
        <section
          className="revenue-report__panel revenue-report__filters"
          aria-label="Bộ lọc báo cáo"
        >
          {dateControls}
          {finance && (
            <label>
              Đơn vị tiền
              <select
                value={currency}
                onChange={(event) =>
                  setParams((previous) => {
                    const updated = new URLSearchParams(previous);
                    updated.set("currency", event.target.value);
                    return updated;
                  })
                }
              >
                {(currencies.length ? currencies : [currency]).map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </label>
          )}
          {!allTime && (tab.id === "tai-chinh" || annual) && (
            <span className="revenue-report__caption revenue-report__comparison">
              {comparisonLabel} {formatDate(comparison.from)} –{" "}
              {formatDate(comparison.to)}
            </span>
          )}
        </section>
      )}
      {tab.id === "xu-huong" &&
        current.isSuccess &&
        (rows.length > 0 || (annual && priorRows.length > 0)) && (
          <RevenueLineChart
            key={`${displayRange.from}/${displayRange.to}/${currency}/${mode}`}
            rows={rows}
            range={displayRange}
            annual={annual}
            previous={
              annual && comparisonReady
                ? { range: comparison, rows: priorRows }
                : undefined
            }
            currency={currency}
          />
        )}
      {tab.id === "van-hanh" && (
        <OperatorBookingAnalytics
          range={range}
          enabled={enabled}
          allTime={allTime}
          dateControls={dateControls}
        />
      )}
      {tab.id === "tai-chinh" && (
        <div className="revenue-report__finance-title" id="tai-chinh">
          <h2>Doanh thu và đối soát</h2>
        </div>
      )}
      {finance && current.isPending && (
        <p className="revenue-report__state" role="status">
          Đang tải báo cáo…
        </p>
      )}
      {finance && current.isError && (
        <div className="revenue-report__state" role="alert">
          <p>
            {noAccess
              ? "Tài khoản này chưa có quyền xem báo cáo doanh thu của nhà xe."
              : "Chưa tải được báo cáo doanh thu."}
          </p>
          {!noAccess && (
            <Button variant="secondary" onClick={() => void current.refetch()}>
              Thử lại
            </Button>
          )}
        </div>
      )}
      {finance && current.isSuccess && (
        <>
          <div className="revenue-report__metadata">
            <span>
              {allTime && !rows.length
                ? "Toàn bộ thời gian"
                : `${formatDate(displayRange.from)} – ${formatDate(displayRange.to)}`}{" "}
              · {currency}
            </span>
            {mostRecent > 0 && (
              <span>
                Số liệu trong kỳ cập nhật đến {timestamp.format(mostRecent)}
              </span>
            )}
          </div>
          {!rows.length && (
            <p className="revenue-report__state" role="status">
              Không có giao dịch bằng {currency} trong khoảng ngày đã chọn.
            </p>
          )}
          {tab.id === "tai-chinh" && rows.length > 0 && (
            <>
              <div
                className="revenue-report__metrics"
                aria-label="Chỉ số tài chính"
              >
                {revenueColumns.map(([key, label]) => {
                  const base = priorTotals[key];
                  return (
                    <section
                      className="revenue-report__metric"
                      data-metric={key}
                      key={key}
                    >
                      <h2>{label}</h2>
                      <strong>{money.format(totals[key])}</strong>
                      {key === "grossRevenue" && (
                        <small>
                          {number.format(totals.paymentCount)} lượt thu
                        </small>
                      )}
                      {key === "refundAmount" && (
                        <small>
                          {number.format(totals.refundCount)} lượt hoàn
                        </small>
                      )}
                      {comparisonReady && (
                        <small>
                          {base === 0
                            ? `${comparisonLabel} ${money.format(base)}`
                            : `${ratio.format((totals[key] - base) / Math.abs(base))} so với ${comparisonLabel.toLowerCase()}`}
                        </small>
                      )}
                    </section>
                  );
                })}
              </div>
              {!allTime && prior.isError && (
                <p className="revenue-report__caption" role="status">
                  Chưa tải được số liệu kỳ trước.{" "}
                  <button type="button" onClick={() => void prior.refetch()}>
                    Tải lại kỳ trước
                  </button>
                </p>
              )}
              <FinanceCharts
                totals={totals}
                previous={comparisonReady ? priorTotals : undefined}
                comparisonLabel={comparisonLabel}
                currency={currency}
              />
              <section
                className="revenue-report__panel"
                aria-labelledby="revenue-breakdown"
              >
                <header className="revenue-report__panel-header">
                  <div>
                    <h2 id="revenue-breakdown">Đối soát theo ngày</h2>
                    <p>
                      {rows.length} ngày có giao dịch · {currency}
                    </p>
                  </div>
                </header>
                <div
                  className="revenue-report__table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Bảng đối soát theo ngày"
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Ngày</th>
                        {revenueColumns.map(([key, label]) => (
                          <th scope="col" key={key}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...rows].reverse().map((row) => (
                        <tr key={row.periodDate}>
                          <th scope="row">{formatDate(row.periodDate)}</th>
                          {revenueColumns.map(([key]) => (
                            <td key={key} data-negative={row[key] < 0}>
                              {number.format(row[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Tổng kỳ</th>
                        {revenueColumns.map(([key]) => (
                          <td key={key} data-negative={totals[key] < 0}>
                            {number.format(totals[key])}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
              <details className="revenue-report__panel revenue-report__definitions">
                <summary>Cách tính các khoản tiền</summary>
                <dl>
                  <dt>Tiền thu và tiền hoàn</dt>
                  <dd>
                    Tiền thu và tiền hoàn được tính theo ngày giao dịch thành
                    công. Đơn trả tại nhà xe không tính vào tiền thu hộ.
                  </dd>
                  <dt>Thu ròng</dt>
                  <dd>
                    Tiền thu trừ tiền hoàn. Nếu hoàn nhiều hơn thu, số này sẽ
                    âm.
                  </dd>
                  <dt>Hoa hồng và phải trả nhà xe</dt>
                  <dd>
                    Hai khoản này được tính từ đối soát đơn trả trước, kể cả
                    điều chỉnh khi hoàn tiền. Số phải trả là số tiền cần thanh
                    toán cho nhà xe.
                  </dd>
                  <dt>Chênh lệch đối soát</dt>
                  <dd>
                    Lấy thu ròng trừ hoa hồng và số phải trả nhà xe. Có thể có
                    chênh lệch nếu giao dịch còn chờ đối soát hoặc các khoản
                    được ghi vào những ngày khác nhau.
                  </dd>
                </dl>
              </details>
            </>
          )}
        </>
      )}
      <PowerBI active={tab.id === "power-bi"} />
    </div>
  );
}
