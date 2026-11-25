import type { ReactElement } from "react";
import { useAdminRefund } from "../hooks/useTransactionData";
import { RefundFacts } from "../components/TransactionFacts";
import { TransactionDetail } from "./TransactionDetail";
import { RefundTransferForm } from "../components/RefundTransferForm";

export function RefundDetailPage({
  refundId,
}: {
  refundId: string;
}): ReactElement {
  const result = useAdminRefund(refundId);
  return (
    <TransactionDetail resource="refunds" result={result}>
      {result.data && <RefundFacts refund={result.data} />}
      {result.data?.transferReference && (
        <p>
          Mã chuyển khoản hoàn tiền ·{" "}
          <strong>{result.data.transferReference}</strong>
        </p>
      )}
      {result.data?.live?.provider === "SEPAY" &&
        result.data.status === "processing" && (
          <RefundTransferForm refund={result.data} />
        )}
    </TransactionDetail>
  );
}
