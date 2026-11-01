import type { ReactElement } from "react";
import { useAdminListParams } from "@/features/admin/hooks/useAdminListParams";
import { useAdminBookings } from "../hooks/useTransactionData";
import { TransactionList } from "./TransactionList";

export function BookingListPage(): ReactElement {
  const { params } = useAdminListParams();
  const result = useAdminBookings(params);
  return <TransactionList resource="bookings" result={result} />;
}
