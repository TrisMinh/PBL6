import type { IssuedTicketSummary } from "@/features/payment/types/payment";

export interface Ticket extends Omit<IssuedTicketSummary, "status"> {
  readonly status: "issued" | "cancelled";
  readonly guestVerification: Readonly<{ email: string; phone: string }>;
  readonly bookingCode: string;
  readonly transactionId: string;
  readonly issuedAt: string;
  readonly passenger: Readonly<{
    seatId: string;
    fullName: string;
    phone?: string;
  }>;
}
