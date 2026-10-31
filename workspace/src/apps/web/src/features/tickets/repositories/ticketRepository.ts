import type {
  LookupInput,
  TicketAccess,
  TicketDetail,
} from "@/features/tickets/types/ticketAccess";

export type TicketHistoryFilter = "all" | "issued" | "cancelled";

export interface TicketRepository {
  getHistory(
    token: string,
    status: TicketHistoryFilter,
    signal?: AbortSignal,
  ): Promise<{
    readonly items: readonly TicketDetail[];
    readonly total: number;
  }>;
  getAccountDetail(
    ticketCode: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<TicketDetail>;
  lookup(input: LookupInput, signal?: AbortSignal): Promise<TicketAccess>;
  getDetail(
    ticketCode: string,
    token: string,
    signal?: AbortSignal,
  ): Promise<TicketDetail>;
}
