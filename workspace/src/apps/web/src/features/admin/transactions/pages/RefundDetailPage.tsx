import type { ReactElement } from "react";
import { useAdminRefund } from "../hooks/useTransactionData";
import { RefundFacts } from "../components/TransactionFacts";
import { TransactionDetail } from "./TransactionDetail";

export function RefundDetailPage({
  refundId,
}: {
  refundId: string;
}): ReactElement {
  const result = useAdminRefund(refundId);
  return (
    <TransactionDetail resource="refunds" result={result}>
      {result.data && <RefundFacts refund={result.data} />}
    </TransactionDetail>
  );
}
