import type { TicketAccess } from "@/features/tickets/types/ticketAccess";

export const MAX_TICKET_ACCESS_SESSIONS = 100;
export interface MockTicketAccess extends TicketAccess {
  readonly createdAt: string;
}
