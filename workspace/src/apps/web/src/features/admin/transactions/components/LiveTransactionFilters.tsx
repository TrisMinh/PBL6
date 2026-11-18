import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { useSearchParams } from "react-router";
import { useStaffOrganizations } from "@/features/admin/staff/hooks/useStaffData";
import { LIVE_TRANSACTION_STATUSES } from "../liveTransactionStatus";
import type { TransactionResource } from "../transactionConfig";

const PLACEHOLDERS = {
  bookings: "Mã đơn, tên khách hoặc nhà xe",
  payments: "Mã thanh toán, mã đơn hoặc cổng thanh toán",
  refunds: "Mã hoàn tiền, mã đơn hoặc lý do",
} satisfies Record<TransactionResource, string>;

export function LiveTransactionFilters({
  resource,
  disabled = false,
  onSearch,
}: {
  resource: TransactionResource;
  disabled?: boolean;
  onSearch: () => void;
}): ReactElement {
  const [params, setParams] = useSearchParams();
  const currentQuery = params.get("query") ?? "";
  const [draft, setDraft] = useState({
    source: currentQuery,
    value: currentQuery,
  });
  const query = draft.source === currentQuery ? draft.value : currentQuery;
  const organizations = useStaffOrganizations();
  useEffect(() => {
    const legacy = params.get("viewStatus");
    if (!legacy) return;
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("viewStatus");
        next.delete("page");
        if (legacy in LIVE_TRANSACTION_STATUSES[resource])
          next.set("status", legacy);
        return next;
      },
      { replace: true },
    );
  }, [params, resource, setParams]);
  const update = (key: string, value: string): void => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("page");
      next.delete("viewStatus");
      next.delete("dialog");
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (query.trim() === currentQuery) onSearch();
    else update("query", query.trim());
  };
  return (
    <form className="transaction-filters" onSubmit={submit}>
      <label className="transaction-filters__field">
        <span className="transaction-filters__label">Tìm kiếm</span>
        <input
          aria-label="Tìm kiếm giao dịch"
          className="transaction-filters__value"
          value={query}
          maxLength={100}
          disabled={disabled}
          placeholder={PLACEHOLDERS[resource]}
          onChange={(event) =>
            setDraft({ source: currentQuery, value: event.target.value })
          }
        />
      </label>
      <label className="transaction-filters__field">
        <span className="transaction-filters__label">Nhà xe</span>
        <select
          aria-label="Nhà xe"
          className="transaction-filters__value"
          value={params.get("organizationId") ?? ""}
          onChange={(event) => update("organizationId", event.target.value)}
          disabled={disabled || organizations.isPending}
        >
          <option value="">Tất cả nhà xe</option>
          {organizations.data?.items.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        {organizations.isError && (
          <span role="alert">
            Không tải được nhà xe.{" "}
            <button type="button" onClick={() => void organizations.refetch()}>
              Thử lại
            </button>
          </span>
        )}
      </label>
      <label className="transaction-filters__field">
        <span className="transaction-filters__label">Trạng thái</span>
        <select
          aria-label="Trạng thái"
          className="transaction-filters__value"
          value={params.get("status") ?? ""}
          onChange={(event) => update("status", event.target.value)}
          disabled={disabled}
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(LIVE_TRANSACTION_STATUSES[resource]).map(
            ([state, label]) => (
              <option key={state} value={state}>
                {label}
              </option>
            ),
          )}
        </select>
      </label>
      <button
        className="transaction-filters__search"
        disabled={disabled}
        type="submit"
      >
        Tra cứu
      </button>
    </form>
  );
}
