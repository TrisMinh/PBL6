import type { z } from "zod";

import type {
  lookupAccessSchema,
  lookupFormSchema,
  ticketDetailSchema,
} from "@/features/tickets/schemas/ticket.schema";

export type LookupInput = z.infer<typeof lookupFormSchema>;
export type TicketAccess = z.infer<typeof lookupAccessSchema>;
export type TicketDetail = z.infer<typeof ticketDetailSchema>;
