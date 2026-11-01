import type { ReactElement } from "react";
import type { BookingAudit } from "../transactionAudit.schema";
import { transactionDate } from "../transactionProjection";

export function TransactionHistory({
  history,
}: {
  history: BookingAudit["history"];
}): ReactElement {
  return (
    <section
      className="transaction-page__history"
      aria-labelledby="transaction-history-title"
    >
      <h2 id="transaction-history-title">Lịch sử giao dịch</h2>
      <dl>
        {history.map((entry, index) => (
          <div
            className="transaction-page__history-entry"
            key={`${entry.occurredAt}-${index}`}
          >
            <dt>{transactionDate(entry.occurredAt, true)} (UTC+7)</dt>
            <dd>{entry.description}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
