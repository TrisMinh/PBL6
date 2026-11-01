import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { PropsWithChildren, ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, expect, it, vi } from "vitest";

import { useCreateBooking } from "@/features/booking/hooks/useCreateBooking";
import {
  createBookingDraftStore,
  useBookingDraftStore,
} from "@/features/booking/store/bookingDraftStore";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { createReadyBookingSession } from "@/test/booking";

const clients: QueryClient[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
});
it.each(["newer-error", "cleared-error"])(
  "suppresses %s feedback after draft ownership changes",
  async (mode) => {
    const state = await setup();
    const initial = useBookingDraftStore.getState().draft;
    if (!initial) throw new Error("Expected draft");
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let began = false;
    server.use(
      http.post("/api/v1/bookings", async () => {
        began = true;
        await held;
        return HttpResponse.json(
          { detail: "PRIVATE_PAYLOAD" },
          { status: 503 },
        );
      }),
    );
    const view = renderHook(() => useCreateBooking(initial), {
      wrapper: state.wrapper,
    });
    act(() => view.result.current.create());
    await waitFor(() => expect(began).toBe(true));
    act(() => {
      if (mode === "cleared-error")
        useBookingDraftStore.getState().clearDraft();
      else
        useBookingDraftStore
          .getState()
          .setDraft({ ...initial, sessionId: "newer" });
    });
    const current = useBookingDraftStore.getState().draft;
    release();
    await waitFor(() => expect(view.result.current.isPending).toBe(false));
    expect(view.result.current.error).toBeNull();
    expect(useBookingDraftStore.getState().draft).toBe(current);
  },
);
it("rejects a response arriving beyond original expiry without writing bookingId", async () => {
  const state = await setup();
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let began = false;
  server.use(
    http.post("/api/v1/bookings", async () => {
      began = true;
      await held;
      return HttpResponse.json(
        {
          bookingId: "late",
          bookingCode: "BLUE-LATE",
          sessionId: state.id,
          totalVnd: 640000,
          status: "pending-payment",
        },
        { status: 201 },
      );
    }),
  );
  const view = renderHook(useSubject, { wrapper: state.wrapper });
  act(() => view.result.current.create());
  await waitFor(() => expect(began).toBe(true));
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(state.expiry));
  release();
  await waitFor(() =>
    expect(view.result.current.error?.code).toBe("HOLD_EXPIRED"),
  );
  expect(useBookingDraftStore.getState().draft?.bookingId).toBeUndefined();
});
async function setup(): Promise<{
  wrapper: ({ children }: PropsWithChildren) => ReactElement;
  id: string;
  expiry: string;
}> {
  const session = await createReadyBookingSession();
  useBookingDraftStore.getState().setDraft(session);
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  function Wrapper({ children }: PropsWithChildren): ReactElement {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/booking/${session.sessionId}/review`]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { wrapper: Wrapper, id: session.sessionId, expiry: session.expiresAt };
}
function useSubject(): ReturnType<typeof useCreateBooking> & { path: string } {
  const draft = useBookingDraftStore((state) => state.draft);
  if (!draft) throw new Error("Expected draft");
  return { ...useCreateBooking(draft), path: useLocation().pathname };
}
it("persists one attempt before POST, locks double-submit and stores bookingId before payment navigation", async () => {
  const state = await setup();
  let count = 0;
  let key: string | null = null;
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.post("/api/v1/bookings", async ({ request }) => {
      count++;
      key = request.headers.get("Idempotency-Key");
      expect(useBookingDraftStore.getState().draft?.bookingAttemptKey).toBe(
        key,
      );
      expect(
        JSON.parse(sessionStorage.getItem("blue-booking-draft") ?? "null").state
          .draft.bookingAttemptKey,
      ).toBe(key);
      await held;
      return undefined;
    }),
  );
  const { result } = renderHook(useSubject, { wrapper: state.wrapper });
  act(() => {
    result.current.create();
    result.current.create();
  });
  await waitFor(() => expect(count).toBe(1));
  expect(result.current.isPending).toBe(true);
  release();
  await waitFor(() =>
    expect(result.current.path).toMatch(/^\/payment\/[^/]+\/vnpay$/),
  );
  const draft = useBookingDraftStore.getState().draft;
  expect(draft).toMatchObject({
    sessionId: state.id,
    bookingAttemptKey: key,
    expiresAt: state.expiry,
    totalVnd: 640000,
    bookingId: expect.any(String),
  });
  expect(result.current.path).toBe(`/payment/${draft?.bookingId}/vnpay`);
});
it("retries with the same persisted key after ambiguous failure and remount", async () => {
  const state = await setup();
  const keys: (string | null)[] = [];
  let first = true;
  server.use(
    http.post("/api/v1/bookings", ({ request }) => {
      keys.push(request.headers.get("Idempotency-Key"));
      if (first) {
        first = false;
        return HttpResponse.json(
          { detail: "PRIVATE_PAYLOAD" },
          { status: 503 },
        );
      }
      return undefined;
    }),
  );
  const view = renderHook(useSubject, { wrapper: state.wrapper });
  act(() => view.result.current.create());
  await waitFor(() => expect(view.result.current.error?.canRetry).toBe(true));
  const saved = useBookingDraftStore.getState().draft;
  view.unmount();
  const fresh = createBookingDraftStore();
  await fresh.persist.rehydrate();
  expect(fresh.getState().draft?.bookingAttemptKey).toBe(
    saved?.bookingAttemptKey,
  );
  const next = renderHook(useSubject, { wrapper: state.wrapper });
  act(() => next.result.current.create());
  await waitFor(() => expect(next.result.current.path).toMatch(/^\/payment/));
  expect(keys).toEqual([saved?.bookingAttemptKey, saved?.bookingAttemptKey]);
});
it.each(["newer", "clear", "same-session", "unmount", "wrong-total"])(
  "ignores stale or invalid %s success without changing ownership",
  async (mode) => {
    const state = await setup();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let began = false;
    server.use(
      http.post("/api/v1/bookings", async () => {
        began = true;
        await held;
        return HttpResponse.json(
          {
            bookingId: "booking-stale",
            bookingCode: "BLUE-STALE",
            sessionId: state.id,
            totalVnd: mode === "wrong-total" ? 1 : 640000,
            status: "pending-payment",
          },
          { status: 201 },
        );
      }),
    );
    const view = renderHook(useSubject, { wrapper: state.wrapper });
    act(() => view.result.current.create());
    await waitFor(() => expect(began).toBe(true));
    const owner = useBookingDraftStore.getState().draft;
    if (!owner) throw new Error("Expected owner");
    if (mode === "unmount" || mode === "clear") view.unmount();
    act(() => {
      if (mode === "newer")
        useBookingDraftStore
          .getState()
          .setDraft({ ...owner, sessionId: "newer" });
      if (mode === "same-session")
        useBookingDraftStore.getState().setContact({
          ...owner.contact,
          fullName: "Người mới",
          email: "test+new@example.invalid",
          phone: "0912345678",
        });
      if (mode === "clear") useBookingDraftStore.getState().clearDraft();
    });
    const before = useBookingDraftStore.getState().draft;
    await act(async () => {
      release();
      await held;
    });
    if (mode === "wrong-total")
      await waitFor(() =>
        expect(view.result.current.error?.code).toBe("INVALID_RESPONSE"),
      );
    else if (mode !== "unmount" && mode !== "clear")
      await waitFor(() => expect(view.result.current.isPending).toBe(false));
    expect(useBookingDraftStore.getState().draft).toBe(before);
    expect(useBookingDraftStore.getState().draft?.bookingId).toBeUndefined();
  },
);
