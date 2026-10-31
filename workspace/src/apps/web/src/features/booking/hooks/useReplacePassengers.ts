import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useEffect, useRef, type RefObject } from "react";
import { useNavigate } from "react-router";

import {
  executePassengerMutation,
  type PassengerMutationVariables,
} from "@/features/booking/lib/passengerMutation";
import type { PassengerFormValues } from "@/features/booking/schemas/passenger.schema";
import type {
  BookingDraft,
  BookingSession,
} from "@/features/booking/types/booking";
import type { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { bookingReviewPath } from "@/shared/config/routes";

export interface ReplacePassengersResult {
  submit: (values: PassengerFormValues) => void;
  isPending: boolean;
  error: BookingRepositoryError | null;
}
interface PassengerAttempt {
  mounted: boolean;
  locked: boolean;
  run: number;
  controller?: AbortController;
}
function usePassengerAttempt(): RefObject<PassengerAttempt> {
  const ref = useRef<PassengerAttempt>({
    mounted: false,
    locked: false,
    run: 0,
  });
  useEffect(() => {
    const state = ref.current;
    state.mounted = true;
    return () => {
      state.mounted = false;
      state.run++;
      state.locked = false;
      state.controller?.abort();
    };
  }, []);
  return ref;
}
function begin(
  attempt: PassengerAttempt,
  source: BookingDraft,
  values: PassengerFormValues,
): PassengerMutationVariables | null {
  if (!attempt.mounted || attempt.locked) return null;
  attempt.locked = true;
  attempt.run++;
  attempt.controller = new AbortController();
  return {
    source,
    values: structuredClone(values),
    run: attempt.run,
    controller: attempt.controller,
  };
}
function current(
  attempt: RefObject<PassengerAttempt>,
  variables: PassengerMutationVariables,
): boolean {
  return attempt.current.mounted && attempt.current.run === variables.run;
}
function finish(attempt: PassengerAttempt): void {
  attempt.locked = false;
}
function usePassengerMutation(
  attempt: RefObject<PassengerAttempt>,
): UseMutationResult<
  BookingSession,
  BookingRepositoryError,
  PassengerMutationVariables
> {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: executePassengerMutation,
    retry: false,
    onSuccess: (session, variables) => {
      if (
        !current(attempt, variables) ||
        useBookingDraftStore.getState().draft !== variables.source
      )
        return;
      useBookingDraftStore.getState().setDraft(session);
      void navigate(bookingReviewPath(session.sessionId));
    },
    onSettled: (_data, _error, variables) => {
      if (current(attempt, variables)) finish(attempt.current);
    },
  });
}
export function useReplacePassengers(
  draft: BookingDraft,
): ReplacePassengersResult {
  const attempt = usePassengerAttempt();
  const mutation = usePassengerMutation(attempt);
  const owner = useBookingDraftStore((state) => state.draft);
  const submit = (values: PassengerFormValues): void => {
    const source = useBookingDraftStore.getState().draft;
    if (source !== draft) return;
    const variables = begin(attempt.current, source, values);
    if (variables) mutation.mutate(variables);
  };
  return {
    submit,
    isPending: mutation.isPending,
    error: mutation.variables?.source === owner ? mutation.error : null,
  };
}
