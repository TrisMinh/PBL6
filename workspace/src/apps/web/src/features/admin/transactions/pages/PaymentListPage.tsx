import type { ReactElement } from "react";
import { useAdminListParams } from "@/features/admin/hooks/useAdminListParams";
import { useAdminPayments } from "../hooks/useTransactionData";
import { TransactionList } from "./TransactionList";

export function PaymentListPage(): ReactElement {
  const { params } = useAdminListParams();
  const result = useAdminPayments(params);
  return <TransactionList resource="payments" result={result} />;
}
