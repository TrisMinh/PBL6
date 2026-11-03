import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useEffect, useRef, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { isMockApi } from "@/shared/api/config";
import { readApiSession } from "@/shared/api/session";

import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type { BookingSession } from "@/features/booking/types/booking";
import { bookingSeatsPath } from "@/shared/config/routes";

export interface CreateBookingSessionResult {
  createSession: (tripId: string, passengerCount: number) => void;
  retry: () => void;
  isPending: boolean;
  pendingTripId: string | null;
  error: BookingRepositoryError | null;
}
interface Attempt {
  tripId?: string;
  passengerCount?: number;
  key?: string;
  run: number;
  mounted: boolean;
  locked: boolean;
  controller?: AbortController;
}
interface Variables {
  tripId: string;
  passengerCount: number;
  idempotencyKey: string;
  run: number;
  controller: AbortController;
}

function useAttempt(): RefObject<Attempt> {
  const attempt = useRef<Attempt>({ run: 0, mounted: false, locked: false });
  useEffect(() => {
    const state = attempt.current;
    state.mounted = true;
    return () => {
      state.mounted = false;
      state.run++;
      state.locked = false;
      state.controller?.abort();
    };
  }, []);
  return attempt;
}
function current(attempt: RefObject<Attempt>, variables: Variables): boolean {
  return attempt.current.mounted && attempt.current.run === variables.run;
}
function begin(
  attempt: Attempt,
  tripId: string,
  passengerCount: number,
): Variables | null {
  if (!attempt.mounted || attempt.locked) return null;
  const key =
    attempt.tripId === tripId &&
    attempt.passengerCount === passengerCount &&
    attempt.key
      ? attempt.key
      : crypto.randomUUID();
  const controller = new AbortController();
  Object.assign(attempt, {
    tripId,
    passengerCount,
    key,
    controller,
    locked: true,
    run: attempt.run + 1,
  });
  return {
    tripId,
    passengerCount,
    idempotencyKey: key,
    run: attempt.run,
    controller,
  };
}
function completeAttempt(attempt: Attempt): void {
  attempt.key = undefined;
  attempt.tripId = undefined;
  attempt.passengerCount = undefined;
}
function unlockAttempt(attempt: Attempt): void {
  attempt.locked = false;
}
function useSessionMutation(
  attempt: RefObject<Attempt>,
): UseMutationResult<BookingSession, BookingRepositoryError, Variables> {
  const navigate = useNavigate();
  const location = useLocation();
  return useMutation<BookingSession, BookingRepositoryError, Variables>({
    mutationKey: ["booking", "create-session"],
    mutationFn: ({ tripId, passengerCount, idempotencyKey, controller }) =>
      httpBookingRepository.createSession(tripId, passengerCount, {
        idempotencyKey,
        signal: controller.signal,
      }),
    retry: false,
    onError: (error, variables) => {
      if (
        !isMockApi &&
        error.code === "ACCESS_REQUIRED" &&
        current(attempt, variables)
      ) {
        void navigate("/login", {
          state: {
            from: location.pathname + location.search,
            bookingIntent: {
              tripId: variables.tripId,
              passengerCount: variables.passengerCount,
            },
          },
        });
      }
    },
    onSuccess: (session, variables) => {
      if (!current(attempt, variables)) return;
      useBookingDraftStore.getState().setDraft(session);
      completeAttempt(attempt.current);
      navigate(bookingSeatsPath(session.sessionId));
    },
    onSettled: (_data, _error, variables) => {
      if (current(attempt, variables)) unlockAttempt(attempt.current);
    },
  });
}
export function useCreateBookingSession(): CreateBookingSessionResult {
  const attempt = useAttempt();
  const mutation = useSessionMutation(attempt);
  const { mutate } = mutation;
  const location = useLocation();
  const navigate = useNavigate();
  const resumed = useRef<string | null>(null);
  useEffect(() => {
    if (isMockApi || resumed.current === location.key || !readApiSession())
      return;
    const state = location.state as { bookingIntent?: unknown } | null;
    const intent = z
      .object({
        tripId: z.string().uuid(),
        passengerCount: z.number().int().min(1).max(6),
      })
      .safeParse(state?.bookingIntent);
    if (!intent.success) return;
    resumed.current = location.key;
    // Consume the intent before starting; a refresh/back must not start it again.
    void navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    });
    const variables = begin(
      attempt.current,
      intent.data.tripId,
      intent.data.passengerCount,
    );
    if (variables) mutate(variables);
  }, [
    location.key,
    location.pathname,
    location.search,
    location.state,
    navigate,
    attempt,
    mutate,
  ]);
  const createSession = (tripId: string, passengerCount: number): void => {
    const variables = begin(attempt.current, tripId, passengerCount);
    if (variables) mutation.mutate(variables);
  };
  return {
    createSession,
    retry: () => {
      if (attempt.current.tripId && attempt.current.passengerCount)
        createSession(attempt.current.tripId, attempt.current.passengerCount);
    },
    isPending: mutation.isPending,
    pendingTripId: mutation.isPending ? mutation.variables.tripId : null,
    error: mutation.error,
  };
}
