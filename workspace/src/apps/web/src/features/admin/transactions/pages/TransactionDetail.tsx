import { transactionErrorState } from "../transactionErrorState";
import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";
import backIcon from "@/assets/admin/transaction-back.svg";
import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
} from "@/features/admin/types/admin";
import { TransactionIntro } from "../components/TransactionIntro";
import { TransactionHistory } from "../components/TransactionHistory";
import type { TransactionResource } from "../transactionConfig";
import { TransactionState } from "../components/TransactionState";
import "./TransactionPages.css";

export function TransactionDetail({
  resource,
  result,
  children,
}: {
  resource: TransactionResource;
  result: {
    data?: AdminBooking | AdminPayment | AdminRefund;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => unknown;
  };
  children: ReactNode;
}): ReactElement {
  const item = result.data;
  const state = result.isPending
    ? "loading"
    : result.isError
      ? transactionErrorState(result.error)
      : undefined;
  return (
    <div className={`transaction-page transaction-page--${resource}`}>
      <TransactionIntro
        resource={resource}
        detail
        subtitle={
          !state && item
            ? `${item.id} · ${item.audit?.organizationName ?? ("organizationId" in item ? item.organizationId : "")}`
            : undefined
        }
      />
      {state ? (
        <section
          className="transaction-page__panel transaction-page__panel--state"
          aria-labelledby="transaction-detail-state-title"
        >
          <h2 id="transaction-detail-state-title">Thông tin giao dịch</h2>
          <TransactionState
            detail
            state={state}
            resource={resource}
            onRetry={() => {
              void result.refetch();
            }}
          />
        </section>
      ) : (
        <div className="transaction-page__detail-body">
          <Link className="transaction-page__back" to={`/admin/${resource}`}>
            <img src={backIcon} alt="" width={18} height={18} />
            Quay lại danh sách
          </Link>
          {children}
          {item?.audit && <TransactionHistory history={item.audit.history} />}
          <p className="transaction-page__detail-footer">
            Dữ liệu cập nhật lúc 10:36 ngày 19/09/2026 (UTC+7)
          </p>
        </div>
      )}
    </div>
  );
}
