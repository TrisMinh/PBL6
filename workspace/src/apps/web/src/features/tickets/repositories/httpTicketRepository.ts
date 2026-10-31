import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { MOCK_SESSION_HEADER } from "@/features/auth/config/session";
import { sessionTokenSchema } from "@/features/auth/schemas/session.schema";
import { requestBooking } from "@/features/booking/repositories/bookingHttp";
import {
  TICKET_ACCESS_HEADER,
  TICKET_ACCESS_TTL_MS,
} from "@/features/tickets/config/access";
import {
  lookupAccessSchema,
  lookupFormSchema,
  lookupTokenSchema,
  ticketCodeSchema,
  ticketDetailSchema,
  ticketHistorySchema,
} from "@/features/tickets/schemas/ticket.schema";
import type { TicketRepository } from "@/features/tickets/repositories/ticketRepository";

export const httpTicketRepository: TicketRepository = {
  getHistory: async (token, status, signal) => {
    if (!sessionTokenSchema.safeParse(token).success)
      throw new BookingRepositoryError("VALIDATION_ERROR", 400);
    const query = new URLSearchParams({ status });
    return requestBooking(`/api/v1/me/tickets?${query}`, ticketHistorySchema, {
      headers: { [MOCK_SESSION_HEADER]: token },
      signal,
      expectedStatus: 200,
    });
  },
  getAccountDetail: async (ticketCode, token, signal) => {
    if (
      !sessionTokenSchema.safeParse(token).success ||
      !ticketCodeSchema.safeParse(ticketCode).success
    )
      throw new BookingRepositoryError("VALIDATION_ERROR", 400);
    const ticket = await requestBooking(
      `/api/v1/tickets/${encodeURIComponent(ticketCode)}`,
      ticketDetailSchema,
      {
        headers: { [MOCK_SESSION_HEADER]: token },
        signal,
        expectedStatus: 200,
      },
    );
    if (ticket.ticketCode !== ticketCode)
      throw new BookingRepositoryError("INVALID_RESPONSE", 200);
    return ticket;
  },
  lookup: async (input, signal) => {
    const parsed = lookupFormSchema.safeParse(input);
    if (!parsed.success)
      throw new BookingRepositoryError("VALIDATION_ERROR", 400);
    const access = await requestBooking(
      "/api/v1/tickets/lookup",
      lookupAccessSchema,
      { method: "POST", body: parsed.data, signal, expectedStatus: 200 },
    );
    const remaining = Date.parse(access.expiresAt) - Date.now();
    if (remaining <= 0 || remaining > TICKET_ACCESS_TTL_MS)
      throw new BookingRepositoryError("INVALID_RESPONSE", 200);
    return access;
  },
  getDetail: async (ticketCode, token, signal) => {
    if (
      !ticketCodeSchema.safeParse(ticketCode).success ||
      !lookupTokenSchema.safeParse(token).success
    )
      throw new BookingRepositoryError("VALIDATION_ERROR", 400);
    const detail = await requestBooking(
      `/api/v1/tickets/${encodeURIComponent(ticketCode)}`,
      ticketDetailSchema,
      {
        headers: { [TICKET_ACCESS_HEADER]: token },
        signal,
        expectedStatus: 200,
      },
    );
    if (detail.ticketCode !== ticketCode)
      throw new BookingRepositoryError("INVALID_RESPONSE", 200);
    return detail;
  },
};
