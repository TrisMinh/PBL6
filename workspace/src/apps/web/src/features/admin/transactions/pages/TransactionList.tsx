import { transactionErrorState } from "../transactionErrorState";
import { type ReactElement } from "react";
import { AdminListPagination } from "@/features/admin/components/AdminFilters/AdminFilters";
import { useAdminListParams } from "@/features/admin/hooks/useAdminListParams";
import { AdminListViewport } from "@/features/admin/components/AdminDataTable/AdminListViewport";
import { Link, useSearchParams } from "react-router";
import {
  AdminDataTable,
  type AdminDataColumn,
} from "@/features/admin/components/AdminDataTable/AdminDataTable";
import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
} from "@/features/admin/types/admin";
import type { PagedResult } from "@/features/admin/types/pagination";
import { TransactionState } from "../components/TransactionState";
import { TransactionIntro } from "../components/TransactionIntro";
import { TransactionFilters } from "../components/TransactionFilters";
import {
  TRANSACTION_CONFIG,
  type TransactionResource,
} from "../transactionConfig";
import {
  bookingLabel,
  paymentLabel,
  refundLabel,
  transactionDate,
  transactionMoney,
  transactionCode,
} from "../transactionProjection";
import "./TransactionPages.css";
import { isMockApi } from "@/shared/api/config";

type Transaction = AdminBooking | AdminPayment | AdminRefund;
interface TransactionResult {
  data?: PagedResult<Transaction>;
  isPending: boolean;
  isError: boolean;
  isPlaceholderData?: boolean;
  error: Error | null;
  refetch: () => unknown;
}
function status(item: Transaction): string {
  return "bookingCode" in item
    ? bookingLabel(item)
    : "transactionCode" in item
      ? paymentLabel(item)
      : refundLabel(item);
}
function columns(
  resource: TransactionResource,
): readonly AdminDataColumn<Transaction>[] {
  const config = TRANSACTION_CONFIG[resource];
  return [
    {
      key: "id",
      header:
        resource === "bookings"
          ? "Mã đơn / Ngày tạo"
          : resource === "payments"
            ? "Mã thanh toán"
            : "Mã hoàn tiền",
      render: (item) => (
        <>
          <Link
            className="transaction-page__record-link"
            to={`/admin/${resource}/${encodeURIComponent(item.id)}`}
          >
            {transactionCode(item)}
          </Link>
          {resource === "bookings" && (
            <span className="transaction-page__created">
              {transactionDate(item.createdAt)}
            </span>
          )}
        </>
      ),
    },
    {
      key: "owner",
      header:
        resource === "bookings"
          ? "Khách hàng"
          : resource === "payments"
            ? "Đơn đặt vé"
            : "Thanh toán gốc",
      render: (item) =>
        "bookingCode" in item
          ? item.customerName
          : "transactionCode" in item
            ? item.live
              ? item.live.bookingCode || "—"
              : item.bookingId
            : item.live
              ? item.live.paymentCode || "—"
              : item.paymentId,
    },
    ...(resource === "bookings"
      ? [
          {
            key: "organization",
            header: "Nhà xe",
            render: (item: Transaction) =>
              item.live?.organizationName ??
              item.audit?.organizationName ??
              ("organizationId" in item ? item.organizationId : "—"),
          },
        ]
      : []),
    {
      key: "amount",
      header:
        resource === "refunds"
          ? "Số tiền hoàn"
          : resource === "bookings"
            ? "Tổng tiền"
            : "Số tiền",
      render: (item) =>
        transactionMoney("totalVnd" in item ? item.totalVnd : item.amountVnd),
    },
    ...(resource === "bookings"
      ? []
      : [
          {
            key: "extra",
            header: resource === "payments" ? "Cổng thanh toán" : "Lý do",
            render: (item: Transaction) =>
              "transactionCode" in item
                ? (item.live?.provider ?? item.audit?.provider ?? "—")
                : "paymentId" in item
                  ? item.live
                    ? item.live.reason || "—"
                    : item.audit?.reason === "operator-cancellation"
                      ? "Nhà xe hủy chuyến"
                      : "Khách hủy vé"
                  : "—",
          },
        ]),
    {
      key: "status",
      header: resource === "bookings" ? "Trạng thái đơn" : "Trạng thái",
      render: status,
    },
    {
      key: "action",
      header: "",
      render: (item) => (
        <Link
          className="transaction-page__table-action"
          aria-label={`${config.action} ${transactionCode(item)}`}
          to={`/admin/${resource}/${encodeURIComponent(item.id)}`}
        >
          {config.action}
        </Link>
      ),
    },
  ];
}
function TransactionPagination({
  data,
  disabled,
}: {
  data: PagedResult<Transaction> | undefined;
  disabled?: boolean;
}): ReactElement | null {
  const { params, updateParams } = useAdminListParams();
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : undefined;
  return (
    <AdminListPagination
      params={params}
      totalPages={totalPages}
      updateParams={updateParams}
      disabled={disabled}
    />
  );
}
export function TransactionList({
  resource,
  result,
}: {
  resource: TransactionResource;
  result: TransactionResult;
}): ReactElement {
  const [params, setParams] = useSearchParams();
  const { params: listParams } = useAdminListParams();
  const config = TRANSACTION_CONFIG[resource];
  const viewStatus = Object.entries(config.statuses).find(
    ([key]) => key === params.get("viewStatus"),
  )?.[1];
  const items =
    result.data?.items.filter(
      (item) => !viewStatus || status(item) === viewStatus,
    ) ?? [];
  const failure = result.isError
    ? transactionErrorState(result.error)
    : undefined;
  const terminal =
    failure === "forbidden" || failure === "not-found" || failure === "invalid";
  const state = result.isPending
    ? "loading"
    : (failure ?? (!items.length ? "empty" : undefined));
  const clear = (): void => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const key of [
        "query",
        "organizationId",
        "status",
        "viewStatus",
        "page",
      ])
        next.delete(key);
      return next;
    });
  };
  return (
    <div className={`transaction-page transaction-page--${resource}`}>
      <TransactionIntro resource={resource} />
      <section
        aria-labelledby={`${resource}-title`}
        aria-busy={result.isPlaceholderData || undefined}
        className={`transaction-page__panel${state ? "transaction-page__panel--state" : ""}`}
      >
        <h2 id={`${resource}-title`}>
          {failure === "forbidden" ? "Quyền truy cập" : config.panel}
        </h2>
        {!terminal && (
          <TransactionFilters
            resource={resource}
            disabled={result.isPending}
            onSearch={() => {
              void result.refetch();
            }}
          />
        )}
        <AdminListViewport
          params={listParams}
          measure={Boolean(result.data) && !result.isPlaceholderData}
          enabled={!result.isError}
        >
          {state ? (
            <TransactionState
              state={state}
              resource={resource}
              onRetry={() => {
                void result.refetch();
              }}
              onClear={clear}
            />
          ) : (
            <AdminDataTable
              caption={config.panel}
              columns={columns(resource)}
              getRowKey={(item) => item.id}
              items={items}
              variant="figma"
            />
          )}
        </AdminListViewport>
        {!state && (
          <>
            {isMockApi && (
              <p className="transaction-page__footer">
                Dữ liệu mẫu • Cập nhật 19/09/2026 lúc 10:36 (UTC+7)
              </p>
            )}
            <button
              className="transaction-page__reset"
              onClick={clear}
              type="button"
            >
              Xóa bộ lọc
            </button>
          </>
        )}
        {!terminal && (
          <div className="admin-list-footer">
            <TransactionPagination
              data={result.data}
              disabled={result.isPlaceholderData}
            />
          </div>
        )}
      </section>
    </div>
  );
}
