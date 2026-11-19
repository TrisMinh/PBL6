import { OperatorStatusBadge } from "../components/OperatorStatusBadge";
import { Toast } from "@/shared/ui/Toast/Toast";
import { displayCode } from "../components/displayCode";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useId, useRef, useState, type ReactElement } from "react";
import { Link } from "react-router";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { WorkspaceDialogHeading } from "./WorkspaceDialogHeading";
import { Button } from "@/shared/ui/Button/Button";
import { OperatorInput as Input } from "../components/OperatorInput";
import {
  getSettlements,
  confirmSettlementReceipt,
  settlementCsv,
  settlementTotals,
  type Settlement,
} from "./operatorWorkspace";
import "../schedule/SchedulePage.css";
import "./OperatorWorkspace.css";
import "./SettlementsPage.css";
import { operatorDefaultRange } from "../operatorDates";
import { isMockApi } from "@/shared/api/config";
import { liveQueryKey } from "@/shared/api/liveRequest";
const labels = {
  paid: "Đã xác nhận nhận tiền",
  pending: "Chờ xác nhận nhận tiền",
  review: "Cần kiểm tra",
  refunded: "Đã hoàn khách",
  excluded: "Không cần chi trả",
} as const;
const money = (value: number, currency: string): string =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(value);
const date = (value: string): string =>
  value ? value.split("-").reverse().join("/") : "—";
export function SettlementsPage(): ReactElement {
  const defaults = operatorDefaultRange("settlements");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [requestedCurrency, setCurrency] = useState("");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [detail, setDetail] = useState<Settlement | null>(null);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [reference, setReference] = useState("");
  const [received, setReceived] = useState("");
  const receiptFormId = useId();
  const detailTrigger = useRef<HTMLButtonElement>(null);
  const canConfirm =
    !isMockApi && detail?.status === "pending" && detail.version != null;
  const query = useQuery({
    queryKey: liveQueryKey("operator-settlements"),
    queryFn: ({ signal }) => getSettlements(signal),
    retry: false,
  });
  const items = query.data ?? [];
  const currencies = [
    ...new Set(items.map((item) => item.currency ?? "VND")),
  ].sort();
  const currency = currencies.includes(requestedCurrency)
    ? requestedCurrency
    : currencies.includes("VND")
      ? "VND"
      : (currencies[0] ?? "VND");
  const confirmation = useMutation({
    mutationFn: ({
      row,
      code,
      amount,
    }: {
      row: Settlement;
      code: string;
      amount: number;
    }) => confirmSettlementReceipt(row, code, amount),
    onSuccess: async (receipt, { row }) => {
      setDetail((current) =>
        current?.code === row.code
          ? {
              ...current,
              status: "paid",
              reference: receipt.reference,
              receipt,
            }
          : current,
      );
      setNotice("Đã lưu xác nhận nhận tiền.");
      await query.refetch();
    },
  });
  function showDetail(row: Settlement): void {
    confirmation.reset();
    setReference("");
    setReceived("");
    setDetail(row);
  }
  const invalidRange = Boolean(from && to && from > to);
  const filtered = items.filter(
    (r) =>
      !invalidRange &&
      (r.currency ?? "VND") === currency &&
      (!from || r.date >= from) &&
      (!to || r.date <= to) &&
      (status === "all" || r.status === status) &&
      `${displayCode(r.code, "DS")} ${r.code} ${r.bookingCode}`
        .toLocaleLowerCase("vi")
        .includes(search.trim().toLocaleLowerCase("vi")),
  );
  const totals = settlementTotals(filtered),
    confirmed = filtered.reduce(
      (total, row) => total + (row.receipt?.amount ?? 0),
      0,
    ),
    pages = Math.max(1, Math.ceil(filtered.length / 8)),
    currentPage = Math.min(page, pages);
  const exportCsv = (): void => {
    const url = URL.createObjectURL(
      new Blob([settlementCsv(filtered)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "blue-doi-soat.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`Đã xuất ${filtered.length} bản ghi đối soát.`);
  };
  const reset = (): void => {
    setSearch("");
    setStatus("all");
    setCurrency("");
    setFrom(defaults.from);
    setTo(defaults.to);
    setPage(1);
  };
  return (
    <div className="operator-schedule operator-workspace-demo operator-settlements">
      <a href="#operator-settlements-main" className="operator-schedule__skip">
        Đến nội dung chính
      </a>
      <OperatorSidebar />
      <main id="operator-settlements-main" className="operator-schedule__main">
        <header className="operator-settlements__header">
          <h1>Đối soát nhà xe</h1>
          <div className="operator-settlements__actions">
            <Button
              variant="secondary"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Làm mới
            </Button>
            <Button
              variant="secondary"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              Xuất CSV
            </Button>
          </div>
        </header>
        {query.isPending && <p role="status">Đang tải đối soát…</p>}
        {query.isError && (
          <p role="alert" className="operator-workspace-demo__error">
            Chưa tải được đối soát. Hãy thử làm mới.
          </p>
        )}
        {notice && <Toast message={notice} onClose={() => setNotice("")} />}
        <section
          className="operator-workspace-demo__metrics"
          aria-label="Tổng hợp đối soát"
        >
          {[
            ["Tiền thu từ khách", totals.gross],
            ["Đã hoàn khách", totals.refunds],
            ["Hoa hồng nền tảng", totals.commission],
            ["Phải trả nhà xe", totals.net],
            ["Tiền đã xác nhận", confirmed],
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{money(Number(value), currency)}</strong>
            </article>
          ))}
        </section>
        <section
          className="operator-workspace-demo__card"
          aria-labelledby="settlement-list"
        >
          <div className="operator-settlements__list-header">
            <h2 id="settlement-list">Chi tiết đối soát</h2>
            <div className="operator-settlements__list-actions">
              <p role="status" className="operator-workspace-demo__muted">
                {filtered.length} kết quả
              </p>
              <Button variant="ghost" onClick={reset}>
                Xóa bộ lọc
              </Button>
            </div>
          </div>
          <div className="operator-settlements__filters">
            <Input
              label="Tìm đối soát"
              type="search"
              placeholder="Mã đối soát hoặc mã đơn"
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
            {currencies.length > 1 && (
              <label className="operator-settlements__currency">
                Tiền tệ
                <select
                  value={currency}
                  onChange={(event) => {
                    setCurrency(event.target.value);
                    setPage(1);
                  }}
                >
                  {currencies.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
            )}
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
          {invalidRange && (
            <p role="alert" className="operator-workspace-demo__error">
              Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
            </p>
          )}
          {filtered.length > 0 ? (
            <div
              className="operator-settlements__table"
              role="region"
              aria-label="Bảng đối soát"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Mã đối soát</th>
                    <th scope="col">Mã đơn</th>
                    <th scope="col">Ngày ghi nhận</th>
                    <th scope="col">Phải trả</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .slice((currentPage - 1) * 8, currentPage * 8)
                    .map((row) => (
                      <tr key={row.code}>
                        <th scope="row">{displayCode(row.code, "DS")}</th>
                        <td>{displayCode(row.bookingCode, "BK")}</td>
                        <td>{date(row.date)}</td>
                        <td>
                          {money(
                            row.net ?? row.gross - row.refunds - row.commission,
                            currency,
                          )}
                        </td>
                        <td>
                          <OperatorStatusBadge
                            state={
                              row.status === "paid" ||
                              row.status === "pending" ||
                              row.status === "review"
                                ? row.status
                                : "review"
                            }
                          >
                            {labels[row.status]}
                          </OperatorStatusBadge>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="operator-settlements__detail"
                            aria-label={`Xem chi tiết ${displayCode(row.code, "DS")}`}
                            onClick={(event) => {
                              detailTrigger.current = event.currentTarget;
                              showDetail(row);
                            }}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            !query.isPending &&
            !query.isError && (
              <p className="operator-workspace-demo__muted">
                Không có khoản đối soát phù hợp.
              </p>
            )
          )}
          {pages > 1 && (
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
          )}
        </section>
      </main>
      <Dialog.Root
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open && !confirmation.isPending) setDetail(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="operator-schedule__overlay" />
          <Dialog.Content
            className="operator-schedule__dialog operator-workspace-demo__dialog operator-settlements__dialog"
            onCloseAutoFocus={(event) => {
              if (!detailTrigger.current?.isConnected) return;
              event.preventDefault();
              detailTrigger.current.focus();
            }}
          >
            <div className="operator-settlements__dialog-header">
              <WorkspaceDialogHeading>
                Đối soát {detail ? displayCode(detail.code, "DS") : ""}
              </WorkspaceDialogHeading>
              <Dialog.Description>
                {detail
                  ? `Đơn ${detail.bookingCode} · Ghi nhận ngày ${date(detail.date)}`
                  : "Thông tin đối soát nhà xe"}
              </Dialog.Description>
            </div>
            {detail && (
              <>
                <div className="operator-settlements__dialog-body">
                  <dl className="operator-settlements__amounts">
                    <div className="operator-settlements__payable">
                      <dt>Phải trả nhà xe</dt>
                      <dd>
                        {money(
                          detail.net ??
                            detail.gross - detail.refunds - detail.commission,
                          currency,
                        )}
                      </dd>
                    </div>
                    <div className="operator-settlements__dialog-status">
                      <dt>Trạng thái</dt>
                      <dd>
                        <OperatorStatusBadge state={detail.status}>
                          {labels[detail.status]}
                        </OperatorStatusBadge>
                      </dd>
                    </div>
                  </dl>
                  <dl className="operator-settlements__breakdown">
                    <div>
                      <dt>Doanh thu</dt>
                      <dd>{money(detail.gross, currency)}</dd>
                    </div>
                    <div>
                      <dt>Hoàn khách</dt>
                      <dd>{money(detail.refunds, currency)}</dd>
                    </div>
                    <div>
                      <dt>Hoa hồng</dt>
                      <dd>{money(detail.commission, currency)}</dd>
                    </div>
                  </dl>
                  {detail.status === "review" && (
                    <p className="operator-settlements__review" role="status">
                      Khoản phải trả đã thay đổi sau khi nhận tiền. Hãy đối
                      chiếu lại với nền tảng.
                    </p>
                  )}
                  {(detail.receipt || detail.reference) && (
                    <dl className="operator-settlements__breakdown">
                      <div>
                        <dt>Mã chuyển khoản</dt>
                        <dd>{detail.reference || "—"}</dd>
                      </div>
                      {detail.receipt && (
                        <>
                          <div>
                            <dt>Tiền đã nhận</dt>
                            <dd>
                              {money(
                                detail.receipt.amount,
                                detail.receipt.currency,
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>Ngày xác nhận</dt>
                            <dd>
                              {new Date(
                                detail.receipt.confirmedAt,
                              ).toLocaleString("vi-VN", {
                                timeZone: "Asia/Ho_Chi_Minh",
                              })}
                            </dd>
                          </div>
                        </>
                      )}
                    </dl>
                  )}
                  {canConfirm && (
                    <form
                      id={receiptFormId}
                      className="operator-settlements__receipt"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (confirmation.isPending) return;
                        confirmation.mutate({
                          row: detail,
                          code: reference.trim(),
                          amount: Number(received),
                        });
                      }}
                    >
                      <h3>Xác nhận tiền đã nhận</h3>
                      <p>
                        Nhập thông tin khi tiền đã vào tài khoản và khớp với sao
                        kê.
                      </p>
                      <div className="operator-settlements__receipt-fields">
                        <Input
                          label="Mã chuyển khoản trên sao kê"
                          required
                          minLength={3}
                          maxLength={100}
                          pattern="[A-Za-z0-9._\/\-]+"
                          value={reference}
                          onChange={(event) => setReference(event.target.value)}
                        />
                        <Input
                          label={`Số tiền đã nhận (${currency})`}
                          type="number"
                          required
                          min={1}
                          step={1}
                          value={received}
                          onChange={(event) => setReceived(event.target.value)}
                        />
                      </div>
                      {confirmation.isError && (
                        <p
                          role="alert"
                          className="operator-workspace-demo__error"
                        >
                          {confirmation.error instanceof Error
                            ? confirmation.error.message
                            : "Chưa lưu được xác nhận."}
                        </p>
                      )}
                    </form>
                  )}
                  <details className="operator-settlements__identifier">
                    <summary>Mã định danh đối soát</summary>
                    <code>{detail.code}</code>
                  </details>
                </div>
                <div className="operator-settlements__dialog-footer">
                  <Link
                    className="button button--secondary"
                    to={`/operator/bookings?search=${encodeURIComponent(detail.bookingCode)}`}
                  >
                    Tra cứu đơn đặt vé
                  </Link>
                  {canConfirm ? (
                    <Button
                      type="submit"
                      form={receiptFormId}
                      isLoading={confirmation.isPending}
                    >
                      Xác nhận đã nhận tiền
                    </Button>
                  ) : (
                    <Dialog.Close asChild>
                      <Button type="button">Đóng</Button>
                    </Dialog.Close>
                  )}
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
