import * as Dialog from "@radix-ui/react-dialog";
import { useState, useEffect, type ReactElement } from "react";
import { Link } from "react-router";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { WorkspaceDialogHeading } from "./WorkspaceDialogHeading";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { StatusBadge } from "@/shared/ui/StatusBadge/StatusBadge";
import {
  getSettlements,
  settlementCsv,
  settlementTotals,
  type Settlement,
} from "./operatorWorkspace";
import "../schedule/SchedulePage.css";
import "./OperatorWorkspace.css";
const labels = {
  paid: "Đã chuyển tiền",
  pending: "Chờ đối soát",
  review: "Cần kiểm tra",
};
const money = (value: number): string => `${value.toLocaleString("vi-VN")} đ`;
const date = (value: string): string => value.split("-").reverse().join("/");
export function SettlementsPage(): ReactElement {
  const [items, setItems] = useState<Settlement[]>([]),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [from, setFrom] = useState("2026-09-01"),
    [to, setTo] = useState("2026-09-30"),
    [detail, setDetail] = useState<Settlement | null>(null),
    [notice, setNotice] = useState(""),
    [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    void getSettlements()
      .then((values) => {
        if (active) setItems(values);
      })
      .catch((error) => {
        if (active)
          setNotice(
            error instanceof Error ? error.message : "Không tải được đối soát.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const invalidRange = Boolean(from && to && from > to);
  const filtered = items.filter(
    (r) =>
      !invalidRange &&
      (!from || r.date >= from) &&
      (!to || r.date <= to) &&
      (status === "all" || r.status === status) &&
      `${r.code} ${r.bookingCode} ${r.route}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  const totals = settlementTotals(filtered),
    pages = Math.max(1, Math.ceil(filtered.length / 8)),
    currentPage = Math.min(page, pages);
  const exportCsv = (): void => {
    const url = URL.createObjectURL(
      new Blob([settlementCsv(filtered)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "blue-doi-soat-demo.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`Đã xuất ${filtered.length} bản ghi đối soát.`);
  };
  const reset = (): void => {
    setSearch("");
    setStatus("all");
    setFrom("2026-09-01");
    setTo("2026-09-30");
    setPage(1);
  };
  return (
    <div className="operator-schedule operator-workspace-demo">
      <a href="#operator-settlements-main" className="operator-schedule__skip">
        Đến nội dung chính
      </a>
      <OperatorSidebar />
      <main id="operator-settlements-main" className="operator-schedule__main">
        <header className="operator-schedule__header">
          <div>
            <h1>Đối soát nhà xe</h1>
            <p className="operator-workspace-demo__muted">
              Theo dõi doanh thu, khoản hoàn và tiền nhà xe nhận.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            Xuất CSV
          </Button>
        </header>
        {notice && (
          <p role="status" className="operator-workspace-demo__notice">
            {notice}
          </p>
        )}
        <section
          className="operator-workspace-demo__metrics"
          aria-label="Tổng hợp đối soát"
        >
          {[
            ["Doanh thu vé", totals.gross],
            ["Đã hoàn khách", totals.refunds],
            ["Hoa hồng nền tảng", totals.commission],
            ["Nhà xe thực nhận", totals.net],
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{money(Number(value))}</strong>
            </article>
          ))}
        </section>
        <section
          className="operator-workspace-demo__card"
          aria-labelledby="settlement-list"
        >
          <div className="operator-workspace-demo__section-heading">
            <h2 id="settlement-list">Chi tiết đối soát</h2>
            <p className="operator-workspace-demo__muted">
              Dữ liệu minh họa · Hoa hồng 5% sau khoản hoàn
            </p>
          </div>
          <div className="operator-workspace-demo__filters">
            <Input
              label="Tìm đối soát"
              type="search"
              placeholder="Mã đối soát, mã đơn, tuyến"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <label>
              Trạng thái
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tất cả trạng thái</option>
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Từ ngày"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
            <Input
              label="Đến ngày"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="operator-workspace-demo__section-heading">
            <p role="status" className="operator-workspace-demo__muted">
              {filtered.length} kết quả
            </p>
            <Button variant="ghost" onClick={reset}>
              Xóa bộ lọc
            </Button>
          </div>
          {invalidRange && (
            <p role="alert" className="operator-workspace-demo__error">
              Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
            </p>
          )}
          <div className="operator-workspace-demo__settlements">
            {filtered
              .slice((currentPage - 1) * 8, currentPage * 8)
              .map((row) => (
                <article key={row.code}>
                  <div>
                    <strong>{row.code}</strong>
                    <p>{row.route}</p>
                    <p className="operator-workspace-demo__muted">
                      {row.bookingCode} · {date(row.date)}
                    </p>
                  </div>
                  <div>
                    <StatusBadge
                      tone={row.status === "paid" ? "success" : "warning"}
                    >
                      {labels[row.status]}
                    </StatusBadge>
                    <p>
                      Thực nhận{" "}
                      <strong>
                        {money(row.gross - row.refunds - row.commission)}
                      </strong>
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    aria-label={`Xem chi tiết ${row.code}`}
                    onClick={() => setDetail(row)}
                  >
                    Chi tiết
                  </Button>
                </article>
              ))}
            {filtered.length === 0 && (
              <div className="operator-workspace-demo__empty">
                <h3>Không có khoản đối soát phù hợp</h3>
                <p>Chọn khoảng thời gian hoặc trạng thái khác.</p>
              </div>
            )}
          </div>
          <nav
            className="operator-workspace-demo__actions"
            aria-label="Phân trang đối soát"
          >
            <Button
              variant="secondary"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Trước
            </Button>
            <span>
              Trang {currentPage} / {pages}
            </span>
            <Button
              variant="secondary"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Sau
            </Button>
          </nav>
        </section>
      </main>
      <Dialog.Root
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="operator-schedule__overlay" />
          <Dialog.Content className="operator-schedule__dialog operator-workspace-demo__dialog">
            <WorkspaceDialogHeading>
              Chi tiết {detail?.code}
            </WorkspaceDialogHeading>
            <Dialog.Description>
              Tiền thực nhận bằng doanh thu trừ khoản hoàn và hoa hồng. Đây là
              dữ liệu demo.
            </Dialog.Description>
            {detail && (
              <>
                <dl className="operator-workspace-demo__facts">
                  {[
                    ["Mã đơn", detail.bookingCode],
                    ["Tuyến", detail.route],
                    ["Ngày đối soát", date(detail.date)],
                    ["Doanh thu", money(detail.gross)],
                    ["Hoàn khách", money(detail.refunds)],
                    ["Hoa hồng", money(detail.commission)],
                    [
                      "Nhà xe nhận",
                      money(detail.gross - detail.refunds - detail.commission),
                    ],
                    ["Trạng thái", labels[detail.status]],
                    [
                      "Tham chiếu",
                      detail.reference || "Chưa có giao dịch chuyển tiền",
                    ],
                  ].map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="operator-workspace-demo__actions">
                  <Link
                    className="button button--secondary"
                    to={`/operator/bookings?search=${encodeURIComponent(detail.bookingCode)}`}
                  >
                    Tra cứu đơn đặt vé
                  </Link>
                  <Dialog.Close asChild>
                    <Button>Đóng</Button>
                  </Dialog.Close>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
