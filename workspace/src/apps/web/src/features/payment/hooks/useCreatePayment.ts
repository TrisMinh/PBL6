import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useEffect, useRef, type RefObject } from "react";
import { useNavigate } from "react-router";

import type { BookingDraft } from "@/features/booking/types/booking";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { httpPaymentRepository } from "@/features/payment/repositories/httpPaymentRepository";
import type {
  PaymentAttempt,
  PaymentStatus,
  PaymentTransaction,
} from "@/features/payment/types/payment";
import { paymentReturnPath } from "@/shared/config/routes";

interface AttemptState {
  mounted: boolean;
  locked: boolean;
  run: number;
  controller?: AbortController;
}
interface Variables {
  source: BookingDraft;
  attempt: PaymentAttempt;
  run: number;
  controller: AbortController;
}
export interface CreatePaymentResult {
  pay: (scenario: PaymentStatus) => void;
  isPending: boolean;
  error: BookingRepositoryError | null;
}
function useAttempt(): RefObject<AttemptState> {
  const ref = useRef<AttemptState>({ mounted: false, locked: false, run: 0 });
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
  state: AttemptState,
  draft: BookingDraft,
  scenario: PaymentStatus,
): Variables | null {
  if (
    !state.mounted ||
    state.locked ||
    useBookingDraftStore.getState().draft !== draft
  )
    return null;
  state.locked = true;
  state.run++;
  state.controller = new AbortController();
  const attempt = draft.paymentAttempt ?? {
    key: crypto.randomUUID(),
    scenario,
  };
  if (!draft.paymentAttempt)
    useBookingDraftStore
      .getState()
      .setDraft({ ...draft, paymentAttempt: attempt });
  const source = useBookingDraftStore.getState().draft;
  return source
    ? { source, attempt, run: state.run, controller: state.controller }
    : null;
}
async function execute(variables: Variables): Promise<PaymentTransaction> {
  const { source, attempt, controller } = variables;
  if (!source.bookingId)
    throw new BookingRepositoryError("VALIDATION_ERROR", 400);
  if (Date.parse(source.expiresAt) <= Date.now())
    throw new BookingRepositoryError("HOLD_EXPIRED", 410);
  const transaction = await httpPaymentRepository.create(
    source.bookingId,
    attempt,
    controller.signal,
  );
  if (Date.parse(source.expiresAt) <= Date.now())
    throw new BookingRepositoryError("HOLD_EXPIRED", 410);
  if (
    transaction.tripId !== source.tripId ||
    transaction.sessionId !== source.sessionId ||
    transaction.amountVnd !== source.totalVnd ||
    transaction.expiresAt !== source.expiresAt
  )
    throw new BookingRepositoryError("INVALID_RESPONSE", 201);
  return transaction;
}
function usePaymentMutation(
  ref: RefObject<AttemptState>,
): UseMutationResult<PaymentTransaction, BookingRepositoryError, Variables> {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: execute,
    retry: false,
    onSuccess: (transaction, variables) => {
      if (
        !ref.current.mounted ||
        ref.current.run !== variables.run ||
        useBookingDraftStore.getState().draft !== variables.source
      )
        return;
      useBookingDraftStore.getState().setDraft({
        ...variables.source,
        paymentAttempt: {
          ...variables.attempt,
          transactionId: transaction.transactionId,
          resultId: transaction.resultId,
        },
      });
      void navigate(
        paymentReturnPath(transaction.transactionId, transaction.resultId),
      );
    },
    onSettled: (_data, error, variables) => {
      if (error && ref.current.mounted && ref.current.run === variables.run)
        ref.current.locked = false;
    },
  });
}
export function useCreatePayment(draft: BookingDraft): CreatePaymentResult {
  const ref = useAttempt(),
    mutation = usePaymentMutation(ref),
    navigate = useNavigate();
  const owner = useBookingDraftStore((s) => s.draft);
  return {
    pay: (scenario) => {
      const variables = begin(ref.current, draft, scenario);
      if (!variables) return;
      if (variables.attempt.transactionId && variables.attempt.resultId) {
        void navigate(
          paymentReturnPath(
            variables.attempt.transactionId,
            variables.attempt.resultId,
          ),
        );
        return;
      }
      mutation.mutate(variables);
    },
    isPending: mutation.isPending,
    error: mutation.variables?.source === owner ? mutation.error : null,
  };
}
