import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { TicketAccess } from "@/features/tickets/types/ticketAccess";
import { ticketAccessStorage } from "@/features/tickets/lib/ticketAccessStorage";
import {
  TICKET_ACCESS_STORAGE_KEY,
  TICKET_DETAIL_QUERY_KEY,
} from "@/features/tickets/config/access";

interface TicketAccessState {
  access: TicketAccess | null;
  isHydrated: boolean;
  revoke: () => void;
}
interface AccessSnapshot {
  access: TicketAccess | null;
  isHydrated: boolean;
}
function useAccessHydration(
  client: QueryClient,
  setState: Dispatch<SetStateAction<AccessSnapshot>>,
): void {
  useEffect(() => {
    let timeoutId: number | undefined, previousToken: string | undefined;
    const hydrate = (): void => {
      window.clearTimeout(timeoutId);
      const access = ticketAccessStorage.read();
      if (!access || access.token !== previousToken)
        client.removeQueries({ queryKey: [TICKET_DETAIL_QUERY_KEY] });
      previousToken = access?.token;
      setState({ access, isHydrated: true });
      if (access)
        timeoutId = window.setTimeout(
          hydrate,
          Math.max(0, Date.parse(access.expiresAt) - Date.now()),
        );
    };
    const onStorage = (event: StorageEvent): void => {
      if (event.key === TICKET_ACCESS_STORAGE_KEY || event.key === null)
        hydrate();
    };
    hydrate();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", hydrate);
    document.addEventListener("visibilitychange", hydrate);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", hydrate);
      document.removeEventListener("visibilitychange", hydrate);
    };
  }, [client, setState]);
}
export function useTicketAccess(): TicketAccessState {
  const [state, setState] = useState<AccessSnapshot>({
    access: null,
    isHydrated: false,
  });
  const client = useQueryClient();
  useAccessHydration(client, setState);
  const revoke = useCallback(() => {
    ticketAccessStorage.clear();
    client.removeQueries({ queryKey: [TICKET_DETAIL_QUERY_KEY] });
    setState({ access: null, isHydrated: true });
  }, [client]);
  return { ...state, revoke };
}
