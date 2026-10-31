import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useEffect, useRef, type RefObject } from "react";
import { useNavigate } from "react-router";

import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { createPassengerSchema } from "@/features/booking/schemas/passenger.schema";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";
import { paymentVnPayPath } from "@/shared/config/routes";

export interface CreateBookingResult {
  create: () => void;
  isPending: boolean;
  error: BookingRepositoryError | null;
}
interface Attempt {
  mounted: boolean;
  locked: boolean;
  run: number;
  controller?: AbortController;
}
interface Variables {
  source: BookingDraft;
  key: string;
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
      state.controller?.abort();
    };
  }, []);
  return ref;
}
function begin(state: Attempt, draft: BookingDraft): Variables | null {
  if (
    !state.mounted ||
    state.locked ||
    useBookingDraftStore.getState().draft !== draft
  )
    return null;
  state.locked = true;
  state.run++;
  state.controller = new AbortController();
  const key = draft.bookingAttemptKey ?? crypto.randomUUID();
  if (!draft.bookingAttemptKey)
    useBookingDraftStore
      .getState()
      .setDraft({ ...draft, bookingAttemptKey: key });
  const source = useBookingDraftStore.getState().draft;
  return source
    ? { source, key, run: state.run, controller: state.controller }
    : null;
}
function active(state: Attempt, variables: Variables): boolean {
  return state.mounted && state.run === variables.run;
}
function finish(state: Attempt): void {
  state.locked = false;
}
async function execute(variables: Variables): Promise<BookingCreationSummary> {
  const { source, key, controller } = variables;
  if (Date.parse(source.expiresAt) <= Date.now())
    throw new BookingRepositoryError("HOLD_EXPIRED", 410);
  let valid = false;
  try {
    valid = createPassengerSchema(source.selectedSeatIds).safeParse({
      contact: source.contact,
      passengers: source.passengers,
    }).success;
  } catch {
    /* Invalid selected-seat factory boundaries fail before the request. */
  }
  if (!valid) throw new BookingRepositoryError("VALIDATION_ERROR", 400);
  const booking = await httpBookingRepository.createBooking(
    source.sessionId,
    key,
    controller.signal,
  );
  if (Date.parse(source.expiresAt) <= Date.now())
    throw new BookingRepositoryError("HOLD_EXPIRED", 410);
  if (
    booking.totalVnd !== source.totalVnd ||
    (source.bookingId && booking.bookingId !== source.bookingId)
  )
    throw new BookingRepositoryError("INVALID_RESPONSE", 201);
  return booking;
}
function useBookingMutation(
  ref: RefObject<Attempt>,
): UseMutationResult<
  BookingCreationSummary,
  BookingRepositoryError,
  Variables
> {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: execute,
    retry: false,
    onSuccess: (booking, variables) => {
      if (
        !active(ref.current, variables) ||
        useBookingDraftStore.getState().draft !== variables.source
      )
        return;
      useBookingDraftStore
        .getState()
        .setDraft({ ...variables.source, bookingId: booking.bookingId });
      void navigate(
        booking.status === "confirmed"
          ? "/account/tickets"
          : paymentVnPayPath(booking.bookingId),
      );
    },
    onSettled: (_data, error, variables) => {
      if (error && active(ref.current, variables)) finish(ref.current);
    },
  });
}
export function useCreateBooking(draft: BookingDraft): CreateBookingResult {
  const ref = useAttempt();
  const mutation = useBookingMutation(ref);
  const owner = useBookingDraftStore((state) => state.draft);
  return {
    create: () => {
      const variables = begin(ref.current, draft);
      if (variables) mutation.mutate(variables);
    },
    isPending: mutation.isPending,
    error: mutation.variables?.source === owner ? mutation.error : null,
  };
}
