import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { PropsWithChildren, ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, expect, it } from "vitest";

import { httpPaymentRepository } from "@/features/payment/repositories/httpPaymentRepository";
import type { BookingSession } from "@/features/booking/types/booking";
import type { BookingCreationSummary } from "@/features/booking/types/bookingSummary";
import type { CreatePaymentResult } from "@/features/payment/hooks/useCreatePayment";
import { useCreatePayment } from "@/features/payment/hooks/useCreatePayment";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { createReadyBookingSession } from "@/test/booking";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
});
async function setup(): Promise<{
  wrapper: (props: PropsWithChildren) => ReactElement;
  session: BookingSession;
  booking: BookingCreationSummary;
}> {
  const session = await createReadyBookingSession();
  const booking = await httpBookingRepository.createBooking(
    session.sessionId,
    "booking-key",
  );
  useBookingDraftStore
    .getState()
    .setDraft({ ...session, bookingId: booking.bookingId });
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  function Wrapper({ children }: PropsWithChildren): ReactElement {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { wrapper: Wrapper, session, booking };
}
function useSubject(): CreatePaymentResult & { path: string } {
  const draft = useBookingDraftStore((s) => s.draft);
  if (!draft) throw new Error("Expected draft");
  return {
    ...useCreatePayment(draft),
    path: useLocation().pathname + useLocation().search,
  };
}
it("persists one key before POST, locks rapid submits and stores opaque IDs before canonical callback navigation", async () => {
  const state = await setup();
  let count = 0,
    key: string | null = null,
    release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.post("/api/v1/payments/vnpay", async ({ request }) => {
      count++;
      key = request.headers.get("Idempotency-Key");
      expect(useBookingDraftStore.getState().draft?.paymentAttempt?.key).toBe(
        key,
      );
      await held;
      return undefined;
    }),
  );
  const view = renderHook(useSubject, { wrapper: state.wrapper });
  act(() => {
    view.result.current.pay("success");
    view.result.current.pay("success");
  });
  await waitFor(() => expect(count).toBe(1));
  expect(view.result.current.isPending).toBe(true);
  release();
  await waitFor(() =>
    expect(view.result.current.path).toMatch(
      /^\/payment\/vnpay\/return\?transactionId=/,
    ),
  );
  const draft = useBookingDraftStore.getState().draft;
  expect(draft).toMatchObject({
    expiresAt: state.session.expiresAt,
    paymentAttempt: {
      key,
      scenario: "success",
      transactionId: expect.any(String),
      resultId: expect.any(String),
    },
  });
  expect(new URLSearchParams(view.result.current.path.split("?")[1]).size).toBe(
    2,
  );
  expect(mockDb.tickets.size).toBe(0);
});
it("reuses the persisted attempt on error/remount retry and resumes saved transaction without another POST", async () => {
  const state = await setup();
  const keys: (string | null)[] = [];
  let first = true;
  server.use(
    http.post("/api/v1/payments/vnpay", ({ request }) => {
      keys.push(request.headers.get("Idempotency-Key"));
      if (first) {
        first = false;
        return HttpResponse.json({ detail: "PRIVATE" }, { status: 503 });
      }
      return undefined;
    }),
  );
  const view = renderHook(useSubject, { wrapper: state.wrapper });
  act(() => view.result.current.pay("failed"));
  await waitFor(() =>
    expect(view.result.current.error?.code).toBe("HTTP_ERROR"),
  );
  const saved = useBookingDraftStore.getState().draft;
  view.unmount();
  const next = renderHook(useSubject, { wrapper: state.wrapper });
  act(() => next.result.current.pay("failed"));
  await waitFor(() => expect(next.result.current.path).toMatch(/return/));
  expect(keys).toEqual([
    saved?.paymentAttempt?.key,
    saved?.paymentAttempt?.key,
  ]);
  next.unmount();
  const resume = renderHook(useSubject, { wrapper: state.wrapper });
  act(() => resume.result.current.pay("failed"));
  await waitFor(() => expect(resume.result.current.path).toMatch(/return/));
  expect(keys).toHaveLength(2);
});
it.each(["newer", "unmount", "same-session"])(
  "suppresses stale %s success and navigation",
  async (mode) => {
    const state = await setup();
    let began = false,
      release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post("/api/v1/payments/vnpay", async () => {
        began = true;
        await held;
        return undefined;
      }),
    );
    const view = renderHook(useSubject, { wrapper: state.wrapper });
    act(() => view.result.current.pay("success"));
    await waitFor(() => expect(began).toBe(true));
    if (mode === "unmount") view.unmount();
    else
      act(() => {
        const draft = useBookingDraftStore.getState().draft;
        if (!draft) throw new Error("Expected draft");
        useBookingDraftStore.getState().setDraft({
          ...draft,
          sessionId: mode === "newer" ? "newer" : draft.sessionId,
          totalVnd: draft.totalVnd + 1,
        });
      });
    const before = useBookingDraftStore.getState().draft;
    release();
    if (mode !== "unmount")
      await waitFor(() => expect(view.result.current.isPending).toBe(false));
    expect(useBookingDraftStore.getState().draft).toBe(before);
    expect(
      useBookingDraftStore.getState().draft?.paymentAttempt?.transactionId,
    ).toBeUndefined();
  },
);

it("rejects canonical trip drift even if booking/session/amount match", async () => {
  const state = await setup();
  const tx = await httpPaymentRepository.create(state.booking.bookingId, {
    key: "seed-payment",
    scenario: "success",
  });
  server.use(
    http.post("/api/v1/payments/vnpay", () =>
      HttpResponse.json({ ...tx, tripId: "foreign-trip" }, { status: 201 }),
    ),
  );
  const view = renderHook(useSubject, { wrapper: state.wrapper });
  act(() => view.result.current.pay("success"));
  await waitFor(() =>
    expect(view.result.current.error?.code).toBe("INVALID_RESPONSE"),
  );
  expect(
    useBookingDraftStore.getState().draft?.paymentAttempt?.transactionId,
  ).toBeUndefined();
});
