export function ticketCancellationAction(ticket: {
  status: string;
  bookingStatus?: string | null;
}): "cancel" | "blocked" | null {
  if (ticket.status !== "issued") return null;
  const status = ticket.bookingStatus;
  if (status === "REFUND_PENDING" || status === "REFUNDED") return "blocked";
  return !status || status === "PAID" || status === "CONFIRMED"
    ? "cancel"
    : null;
}
