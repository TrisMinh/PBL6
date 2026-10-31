import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { TICKET_DETAIL_QUERY_KEY } from "@/features/tickets/config/access";
import { httpTicketRepository } from "@/features/tickets/repositories/httpTicketRepository";
import type {
  TicketAccess,
  TicketDetail,
} from "@/features/tickets/types/ticketAccess";

export function useTicketDetail(
  ticketCode: string,
  access: TicketAccess,
): UseQueryResult<TicketDetail, BookingRepositoryError> {
  return useQuery({
    queryKey: Object.freeze([
      TICKET_DETAIL_QUERY_KEY,
      ticketCode,
      access.expiresAt,
    ]),
    queryFn: ({ signal }) =>
      httpTicketRepository.getDetail(ticketCode, access.token, signal),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}
