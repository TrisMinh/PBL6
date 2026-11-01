import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { PropsWithChildren, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import { bookingKeys } from "@/features/booking/api/bookingQueryKeys";
import { useReplaceSeats } from "@/features/booking/hooks/useReplaceSeats";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { server } from "@/mocks/server";
import { mockDb } from "@/mocks/state/mockDb";

const TRIP = "trip-hcm-dalat-early";
const clients: QueryClient[] = [];
beforeEach(() => mockDb.reset());
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
});
async function setup(
  count = 1,
  tripId = TRIP,
): Promise<{
  draft: BookingDraft;
  layout: SeatLayout;
  client: QueryClient;
  wrapper: ({ children }: PropsWithChildren) => ReactElement;
}> {
  const created = await httpBookingRepository.createSession(tripId, 2);
  const initial = await httpBookingRepository.getSeats(tripId);
  const ids = initial.items
    .filter((seat) => seat.status === "available")
    .slice(0, count)
    .map((seat) => seat.id);
  const session = await httpBookingRepository.replaceSeats(
    created.sessionId,
    ids,
  );
  useBookingDraftStore.getState().setDraft({
    ...session,
    contact: {
      fullName: "Mock",
      email: "mock@example.invalid",
      phone: "mock",
    },
    passengers: ids.map((seatId) => ({ seatId, fullName: "Mock" })),
  });
  const draft = useBookingDraftStore.getState().draft;
  if (!draft) throw new Error("Expected draft");
  const layout = await httpBookingRepository.getSeats(tripId);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  client.setQueryData(bookingKeys.seats(tripId), layout);
  function Wrapper({ children }: PropsWithChildren): ReactElement {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { draft, layout, client, wrapper: Wrapper };
}
describe("atomic optimistic seat mutation", () => {
  it("optimistically replaces full selection/total/cache then commits without renewing expiry", async () => {
    const state = await setup();
    const next = state.layout.items.find((seat) => seat.status === "available");
    if (!next) throw new Error("Expected seat");
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/seats", async () => {
        await held;
        return undefined;
      }),
    );
    const { result } = renderHook(
      () => useReplaceSeats(state.draft, state.layout),
      { wrapper: state.wrapper },
    );
    act(() => result.current.toggle(next.id));
    await waitFor(() =>
      expect(
        useBookingDraftStore.getState().draft?.selectedSeatIds,
      ).toHaveLength(2),
    );
    expect(useBookingDraftStore.getState().draft?.totalVnd).toBe(640_000);
    expect(result.current.isPending).toBe(true);
    release();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(useBookingDraftStore.getState().draft?.expiresAt).toBe(
      state.draft.expiresAt,
    );
    expect(
      mockDb.sessions.get(state.draft.sessionId)?.selectedSeatIds,
    ).toHaveLength(2);
  });
  it.each(["network", "server", "conflict", "expired", "drift"])(
    "restores entire draft/query snapshot on%s error",
    async (mode) => {
      const state = await setup();
      const previous = structuredClone(state.draft);
      const cache = structuredClone(
        state.client.getQueryData(bookingKeys.seats(TRIP)),
      );
      const next = state.layout.items.find(
        (seat) => seat.status === "available",
      );
      if (!next) throw new Error("Expected seat");
      server.use(
        http.put("/api/v1/booking-sessions/:sessionId/seats", () =>
          mode === "network"
            ? HttpResponse.error()
            : mode === "drift"
              ? HttpResponse.json({
                  ...mockDb.sessions.get(state.draft.sessionId),
                  totalVnd: 1,
                })
              : HttpResponse.json(
                  {
                    code:
                      mode === "conflict" ? "SEAT_CONFLICT" : "HOLD_EXPIRED",
                    conflictingSeatIds: [next.id],
                  },
                  {
                    status:
                      mode === "server" ? 500 : mode === "expired" ? 410 : 409,
                  },
                ),
        ),
      );
      const { result } = renderHook(
        () => useReplaceSeats(state.draft, state.layout),
        { wrapper: state.wrapper },
      );
      act(() => result.current.toggle(next.id));
      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(useBookingDraftStore.getState().draft).toEqual(previous);
      await waitFor(() =>
        expect(state.client.getQueryData(bookingKeys.seats(TRIP))).toEqual(
          cache,
        ),
      );
    },
  );
  it("rejects seventh seat before network and uses native stable ID deselection", async () => {
    const state = await setup(6, "trip-hcm-dalat-cabin");
    const calls = vi.fn();
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/seats", () => {
        calls();
        return undefined;
      }),
    );
    const next = state.layout.items.find((seat) => seat.status === "available");
    if (!next) throw new Error("Expected seat");
    const { result } = renderHook(
      () => useReplaceSeats(state.draft, state.layout),
      { wrapper: state.wrapper },
    );
    act(() => result.current.toggle(next.id));
    expect(result.current.limitReached).toBe(true);
    expect(calls).not.toHaveBeenCalled();
    expect(useBookingDraftStore.getState().draft?.selectedSeatIds).toHaveLength(
      6,
    );
    const own = state.draft.selectedSeatIds[0];
    if (!own) throw new Error("Expected own held seat");
    act(() => result.current.toggle(own));
    await waitFor(() => expect(calls).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(
      useBookingDraftStore.getState().draft?.selectedSeatIds,
    ).not.toContain(own);
  });
});
it("aborts on unmount and restores the entire optimistic snapshot", async () => {
  const state = await setup();
  const next = state.layout.items.find((seat) => seat.status === "available");
  if (!next) throw new Error("Expected seat");
  let release: () => void = () => undefined;
  let entered: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  server.use(
    http.put("/api/v1/booking-sessions/:sessionId/seats", async () => {
      entered();
      await held;
      return undefined;
    }),
  );
  const { result, unmount } = renderHook(
    () => useReplaceSeats(state.draft, state.layout),
    { wrapper: state.wrapper },
  );
  act(() => result.current.toggle(next.id));
  await started;
  await waitFor(() =>
    expect(useBookingDraftStore.getState().draft?.selectedSeatIds).toHaveLength(
      2,
    ),
  );
  unmount();
  release();
  await waitFor(() =>
    expect(useBookingDraftStore.getState().draft).toEqual(state.draft),
  );
  expect(state.client.getQueryData(bookingKeys.seats(TRIP))).toEqual(
    state.layout,
  );
});
it.each(["success", "error"])(
  "never overwrites a newer draft on stale %s",
  async (mode) => {
    const state = await setup();
    const next = state.layout.items.find((seat) => seat.status === "available");
    if (!next) throw new Error("Expected seat");
    let release: () => void = () => undefined;
    let entered: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/seats", async () => {
        entered();
        await held;
        return mode === "error"
          ? HttpResponse.json({}, { status: 500 })
          : undefined;
      }),
    );
    const { result } = renderHook(
      () => useReplaceSeats(state.draft, state.layout),
      { wrapper: state.wrapper },
    );
    act(() => result.current.toggle(next.id));
    await started;
    const newer = { ...state.draft, sessionId: "newer-session" };
    useBookingDraftStore.getState().setDraft(newer);
    release();
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(useBookingDraftStore.getState().draft).toEqual(newer);
  },
);
it("ignores unknown/unavailable IDs and rapid duplicate toggles", async () => {
  const state = await setup();
  const calls = vi.fn();
  server.use(
    http.put("/api/v1/booking-sessions/:sessionId/seats", () => {
      calls();
      return undefined;
    }),
  );
  const next = state.layout.items.find((seat) => seat.status === "available");
  if (!next) throw new Error("Expected seat");
  const sold = state.layout.items.find((seat) => seat.status === "sold");
  if (!sold) throw new Error("Expected sold");
  const { result } = renderHook(
    () => useReplaceSeats(state.draft, state.layout),
    { wrapper: state.wrapper },
  );
  act(() => {
    result.current.toggle("unknown");
    result.current.toggle(sold.id);
  });
  expect(calls).not.toHaveBeenCalled();
  act(() => {
    result.current.toggle(next.id);
    result.current.toggle(next.id);
  });
  await waitFor(() => expect(calls).toHaveBeenCalledOnce());
  await waitFor(() => expect(result.current.isPending).toBe(false));
});
