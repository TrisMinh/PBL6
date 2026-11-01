import type { ReactElement } from "react";
import { useAdminListParams } from "@/features/admin/hooks/useAdminListParams";
import { useAdminRefunds } from "../hooks/useTransactionData";
import { TransactionList } from "./TransactionList";

export function RefundListPage(): ReactElement {
  const { params } = useAdminListParams();
  const result = useAdminRefunds(params);
  return <TransactionList resource="refunds" result={result} />;
}
