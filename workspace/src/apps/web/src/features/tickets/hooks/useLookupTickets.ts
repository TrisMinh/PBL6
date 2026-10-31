import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type RefObject } from "react";
import { useNavigate } from "react-router";

import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { TICKET_DETAIL_QUERY_KEY } from "@/features/tickets/config/access";
import { ticketAccessStorage } from "@/features/tickets/lib/ticketAccessStorage";
import { httpTicketRepository } from "@/features/tickets/repositories/httpTicketRepository";
import type {
  LookupInput,
  TicketAccess,
} from "@/features/tickets/types/ticketAccess";
import { ticketPath } from "@/shared/config/routes";

interface Attempt {
  mounted: boolean;
  locked: boolean;
  run: number;
  controller?: AbortController;
  input?: LookupInput;
}
interface Variables {
  run: number;
  controller: AbortController;
}
function useAttempt(): RefObject<Attempt> {
  const ref = useRef<Attempt>({ mounted: false, locked: false, run: 0 });
  useEffect(() => {
    const state = ref.current;
    state.mounted = true;
    return () => {
      state.mounted = false;
      state.run++;
      state.locked = false;
      delete state.input;
      state.controller?.abort();
    };
  }, []);
  return ref;
}
interface LookupResult {
  submit: (input: LookupInput) => void;
  isPending: boolean;
  error: BookingRepositoryError | null;
}
async function executeLookup(
  ref: RefObject<Attempt>,
  { run, controller }: Variables,
): Promise<TicketAccess> {
  const input = ref.current.input;
  delete ref.current.input;
  if (!input) throw new BookingRepositoryError("VALIDATION_ERROR", 400);
  const access = await httpTicketRepository.lookup(input, controller.signal);
  if (!ref.current.mounted || ref.current.run !== run)
    throw new BookingRepositoryError("ABORTED");
  if (!ticketAccessStorage.write(access))
    throw new BookingRepositoryError("STORAGE_UNAVAILABLE");
  return access;
}
export function useLookupTickets(): LookupResult {
  const ref = useAttempt(),
    navigate = useNavigate(),
    client = useQueryClient();
  const mutation = useMutation<TicketAccess, BookingRepositoryError, Variables>(
    {
      retry: false,
      mutationFn: (variables) => executeLookup(ref, variables),
      onSuccess: (access, { run }) => {
        if (ref.current.mounted && ref.current.run === run) {
          client.removeQueries({ queryKey: [TICKET_DETAIL_QUERY_KEY] });
          void navigate(ticketPath(access.ticketCodes[0]));
        }
      },
      onSettled: (_data, error, { run }) => {
        if (error && ref.current.run === run) ref.current.locked = false;
      },
    },
  );
  return {
    isPending: mutation.isPending,
    error: mutation.error,
    submit: (input) => {
      const state = ref.current;
      if (!state.mounted || state.locked) return;
      state.locked = true;
      state.run++;
      state.controller = new AbortController();
      state.input = { ...input };
      mutation.mutate({ run: state.run, controller: state.controller });
    },
  };
}
