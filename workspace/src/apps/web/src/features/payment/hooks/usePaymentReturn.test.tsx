import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { PropsWithChildren, ReactElement } from "react";
import { afterEach, expect, it } from "vitest";

import type { PaymentStatus } from "@/features/payment/types/payment";
import { usePaymentReturn } from "@/features/payment/hooks/usePaymentReturn";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { createReadyPayment } from "@/test/payment";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
});
function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return function Wrapper({ children }: PropsWithChildren): ReactElement {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}
it("clears only after validated exact tickets exist, then refreshes success without the draft", async () => {
  const { draft, transaction } = await createReadyPayment();
  useBookingDraftStore.getState().setDraft(draft);
  let began = false,
    release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.post("/api/v1/payments/vnpay/return", async () => {
      began = true;
      await held;
      return undefined;
    }),
  );
  const view = renderHook(
    () => usePaymentReturn(transaction.transactionId, transaction.resultId),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(began).toBe(true));
  expect(useBookingDraftStore.getState().draft?.bookingId).toBe(
    draft.bookingId,
  );
  release();
  await waitFor(() =>
    expect(view.result.current.data?.tickets).toHaveLength(2),
  );
  await waitFor(() => expect(useBookingDraftStore.getState().draft).toBeNull());
  expect(sessionStorage.getItem("blue-booking-draft")).toBeNull();
  view.unmount();
  const fresh = renderHook(
    () => usePaymentReturn(transaction.transactionId, transaction.resultId),
    { wrapper: wrapper() },
  );
  await waitFor(() =>
    expect(fresh.result.current.data?.status).toBe("success"),
  );
  expect(mockDb.tickets.size).toBe(2);
});
it.each(["failed", "cancelled", "pending"] satisfies PaymentStatus[])(
  "preserves %s booking recovery and rotates only terminal attempt metadata",
  async (scenario) => {
    const { draft, transaction } = await createReadyPayment(scenario);
    useBookingDraftStore.getState().setDraft(draft);
    const view = renderHook(
      () => usePaymentReturn(transaction.transactionId, transaction.resultId),
      { wrapper: wrapper() },
    );
    await waitFor(() =>
      expect(view.result.current.data?.status).toBe(scenario),
    );
    const current = useBookingDraftStore.getState().draft;
    expect(current).toMatchObject({
      sessionId: draft.sessionId,
      bookingId: draft.bookingId,
      totalVnd: draft.totalVnd,
      expiresAt: draft.expiresAt,
      passengers: draft.passengers,
      contact: draft.contact,
    });
    if (scenario === "pending")
      expect(current?.paymentAttempt).toEqual(draft.paymentAttempt);
    else
      await waitFor(() =>
        expect(
          useBookingDraftStore.getState().draft?.paymentAttempt,
        ).toBeUndefined(),
      );
    expect(mockDb.tickets.size).toBe(0);
  },
);
it("preserves a newer unrelated draft when a success response arrives", async () => {
  const { draft, transaction } = await createReadyPayment();
  useBookingDraftStore
    .getState()
    .setDraft({ ...draft, bookingId: "newer-booking" });
  const current = useBookingDraftStore.getState().draft;
  const view = renderHook(
    () => usePaymentReturn(transaction.transactionId, transaction.resultId),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(view.result.current.data?.status).toBe("success"));
  expect(useBookingDraftStore.getState().draft).toEqual(current);
});
it("never clears on malformed success response and allows explicit same-receipt recheck", async () => {
  const { draft, transaction } = await createReadyPayment();
  useBookingDraftStore.getState().setDraft(draft);
  const before = useBookingDraftStore.getState().draft;
  server.use(
    http.post("/api/v1/payments/vnpay/return", () =>
      HttpResponse.json({ status: "success", tickets: [] }),
    ),
  );
  const view = renderHook(
    () => usePaymentReturn(transaction.transactionId, transaction.resultId),
    { wrapper: wrapper() },
  );
  await waitFor(() =>
    expect(view.result.current.error?.code).toBe("INVALID_RESPONSE"),
  );
  expect(useBookingDraftStore.getState().draft).toEqual(before);
  server.resetHandlers();
  await act(async () => {
    await view.result.current.refetch();
  });
  await waitFor(() => expect(view.result.current.data?.status).toBe("success"));
  expect(mockDb.tickets.size).toBe(2);
});

it.each(["selection", "amount", "transaction"])(
  "never clears a draft with mismatched %s despite a valid server success",
  async (mode) => {
    const { draft, transaction } = await createReadyPayment();
    const changed: import("@/features/booking/types/booking").BookingDraft = {
      ...draft,
      ...(mode === "selection"
        ? { selectedSeatIds: [draft.selectedSeatIds[0]] }
        : mode === "amount"
          ? { totalVnd: draft.totalVnd + 1 }
          : {
              paymentAttempt: {
                ...draft.paymentAttempt,
                key: "new-key",
                scenario: "success",
                transactionId: "another-tx",
                resultId: "another-result",
              },
            }),
    };
    useBookingDraftStore.getState().setDraft(changed);
    const expected = useBookingDraftStore.getState().draft;
    const view = renderHook(
      () => usePaymentReturn(transaction.transactionId, transaction.resultId),
      { wrapper: wrapper() },
    );
    await waitFor(() =>
      expect(view.result.current.data?.status).toBe("success"),
    );
    expect(useBookingDraftStore.getState().draft).toEqual(expected);
  },
);
