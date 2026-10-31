import type { TicketAccess } from "@/features/tickets/types/ticketAccess";
import { lookupAccessSchema } from "@/features/tickets/schemas/ticket.schema";
import {
  TICKET_ACCESS_STORAGE_KEY,
  TICKET_ACCESS_TTL_MS,
} from "@/features/tickets/config/access";

type AccessStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
interface TicketAccessStorage {
  read: () => TicketAccess | null;
  write: (access: TicketAccess) => boolean;
  clear: () => void;
}
function parsedAccess(value: unknown): TicketAccess | null {
  const parsed = lookupAccessSchema.safeParse(value);
  if (!parsed.success) return null;
  const remaining = Date.parse(parsed.data.expiresAt) - Date.now();
  return remaining > 0 && remaining <= TICKET_ACCESS_TTL_MS
    ? parsed.data
    : null;
}
export function createTicketAccessStorage(
  resolve: () => AccessStorage = () => window.sessionStorage,
): TicketAccessStorage {
  const clear = (): void => {
    try {
      resolve().removeItem(TICKET_ACCESS_STORAGE_KEY);
    } catch {
      /* Storage denial revokes local access safely. */
    }
  };
  return {
    read: () => {
      try {
        const raw = resolve().getItem(TICKET_ACCESS_STORAGE_KEY);
        if (!raw) return null;
        const access =
          raw.length <= 4096 ? parsedAccess(JSON.parse(raw)) : null;
        if (!access) clear();
        return access;
      } catch {
        clear();
        return null;
      }
    },
    write: (access) => {
      const parsed = parsedAccess(access);
      if (!parsed) return false;
      try {
        resolve().setItem(TICKET_ACCESS_STORAGE_KEY, JSON.stringify(parsed));
        return true;
      } catch {
        clear();
        return false;
      }
    },
    clear,
  };
}
export const ticketAccessStorage = createTicketAccessStorage();
