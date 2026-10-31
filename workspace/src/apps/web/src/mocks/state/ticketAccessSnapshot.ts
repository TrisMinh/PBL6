import { z } from "zod";

import { TICKET_ACCESS_TTL_MS } from "@/features/tickets/config/access";
import { lookupAccessSchema } from "@/features/tickets/schemas/ticket.schema";
import type { MockDb } from "@/mocks/state/mockDb";
import {
  MAX_TICKET_ACCESS_SESSIONS,
  type MockTicketAccess,
} from "@/mocks/state/ticketAccessState";

export const ticketAccessSnapshotSchema = z
  .array(
    lookupAccessSchema
      .unwrap()
      .extend({ createdAt: z.iso.datetime() })
      .strict()
      .readonly(),
  )
  .max(MAX_TICKET_ACCESS_SESSIONS)
  .default([]);
export function validTicketAccess(
  grants: readonly MockTicketAccess[],
  tickets: readonly {
    ticketCode: string;
    bookingCode: string;
    issuedAt: string;
  }[],
  now: number,
): boolean {
  return (
    new Set(grants.map((g) => g.token)).size === grants.length &&
    grants.every((g) => {
      const scoped = tickets.filter((t) =>
        g.ticketCodes.includes(t.ticketCode),
      );
      return (
        Date.parse(g.createdAt) <= now &&
        Date.parse(g.expiresAt) - Date.parse(g.createdAt) ===
          TICKET_ACCESS_TTL_MS &&
        scoped.length === g.ticketCodes.length &&
        new Set(scoped.map((t) => t.bookingCode)).size === 1 &&
        scoped.every((t) => Date.parse(t.issuedAt) <= Date.parse(g.createdAt))
      );
    })
  );
}
export function collectTicketAccess(
  db: MockDb,
  now: number,
): MockTicketAccess[] {
  return [...db.ticketAccess.values()].filter(
    (g) => Date.parse(g.expiresAt) > now,
  );
}
