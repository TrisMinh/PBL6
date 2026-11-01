import type { ReactElement } from "react";
import { useAdminBooking } from "../hooks/useTransactionData";
import { BookingFacts } from "../components/TransactionFacts";
import { TransactionDetail } from "./TransactionDetail";

export function BookingDetailPage({
  bookingId,
}: {
  bookingId: string;
}): ReactElement {
  const result = useAdminBooking(bookingId);
  return (
    <TransactionDetail resource="bookings" result={result}>
      {result.data && <BookingFacts booking={result.data} />}
    </TransactionDetail>
  );
}
