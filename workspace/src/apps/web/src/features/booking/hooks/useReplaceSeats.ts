import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useState } from "react";

import {
  beginSeatMutation,
  commitSeatMutation,
  executeSeatMutation,
  rollbackSeatMutation,
  type SeatMutationVariables,
  type SeatMutationSnapshot,
} from "@/features/booking/lib/seatMutation";
import { useSeatAttempt } from "@/features/booking/hooks/useSeatAttempt";
import type { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type {
  BookingDraft,
  BookingSession,
} from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";

export interface ReplaceSeatsResult {
  toggle: (id: string) => void;
  isPending: boolean;
  error: BookingRepositoryError | null;
  limitReached: boolean;
  dismissError: () => void;
}
function useSeatMutation(
  finish: () => void,
  alive: () => boolean,
): UseMutationResult<
  BookingSession,
  BookingRepositoryError,
  SeatMutationVariables,
  SeatMutationSnapshot
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: executeSeatMutation,
    onMutate: (variables) => beginSeatMutation(client, variables),
    onSuccess: (session, variables) =>
      commitSeatMutation(client, session, variables, alive()),
    onError: (error, variables, snapshot) =>
      rollbackSeatMutation(client, error, variables, snapshot),
    onSettled: finish,
    retry: false,
  });
}
function replacement(
  draft: BookingDraft,
  layout: SeatLayout,
  id: string,
): string[] | null {
  const seat = layout.items.find((seat) => seat.id === id);
  const selected = draft.selectedSeatIds.includes(id);
  if (
    !seat ||
    (seat.status !== "available" && !(selected && seat.status === "held"))
  )
    return null;
  return selected
    ? draft.selectedSeatIds.filter((seatId) => seatId !== id)
    : [...draft.selectedSeatIds, id];
}
export function useReplaceSeats(
  draft: BookingDraft,
  layout: SeatLayout,
): ReplaceSeatsResult {
  const attempt = useSeatAttempt();
  const [limitReached, setLimitReached] = useState(false);
  const mutation = useSeatMutation(attempt.finish, attempt.isAlive);
  const toggle = (id: string): void => {
    const previous = useBookingDraftStore.getState().draft;
    if (previous?.sessionId !== draft.sessionId) return;
    const seatIds = replacement(previous, layout, id);
    if (!seatIds) return;
    if (seatIds.length > 6) {
      setLimitReached(true);
      return;
    }
    const controller = attempt.begin();
    if (!controller) return;
    setLimitReached(false);
    mutation.mutate({
      previous: structuredClone(previous),
      layout,
      seatIds,
      controller,
    });
  };
  return {
    toggle,
    isPending: mutation.isPending,
    error: mutation.error,
    limitReached,
    dismissError: () => {
      mutation.reset();
      setLimitReached(false);
    },
  };
}
