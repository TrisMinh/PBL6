export interface BookingCreationSummary {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly sessionId: string;
  readonly totalVnd: number;
  readonly status: "pending-payment" | "confirmed";
}
