import type { ReactElement } from "react";
import { useAdminPayment } from "../hooks/useTransactionData";
import { PaymentFacts } from "../components/TransactionFacts";
import { TransactionDetail } from "./TransactionDetail";

export function PaymentDetailPage({
  paymentId,
}: {
  paymentId: string;
}): ReactElement {
  const result = useAdminPayment(paymentId);
  return (
    <TransactionDetail resource="payments" result={result}>
      {result.data && <PaymentFacts payment={result.data} />}
    </TransactionDetail>
  );
}
