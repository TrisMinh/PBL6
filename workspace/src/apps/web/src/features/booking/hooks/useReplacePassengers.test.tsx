import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import type { PropsWithChildren, ReactElement } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { useReplacePassengers } from "@/features/booking/hooks/useReplacePassengers";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type { BookingDraft } from "@/features/booking/types/booking";
import { server } from "@/mocks/server";
import { mockDb } from "@/mocks/state/mockDb";

const TRIP = "trip-hcm-dalat-early";
const clients: QueryClient[] = [];
const VALUES = {
  contact: {
    fullName: "Khách Liên Hệ",
    email: "test+mock@example.invalid",
    phone: "0912345678",
  },
  passengers: [
    { seatId: `${TRIP}:A01`, fullName: "Khách Một" },
    { seatId: `${TRIP}:A02`, fullName: "Khách Hai" },
  ],
};
async function setup(): Promise<{
  draft: BookingDraft;
  wrapper: ({ children }: PropsWithChildren) => ReactElement;
}> {
  const created = await httpBookingRepository.createSession(TRIP, 2);
  const saved = await httpBookingRepository.replaceSeats(
    created.sessionId,
    VALUES.passengers.map((p) => p.seatId),
  );
  useBookingDraftStore.getState().setDraft(saved);
  const draft = useBookingDraftStore.getState().draft;
  if (!draft) throw new Error("Expected draft");
  const sessionId = draft.sessionId;
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  function Wrapper({ children }: PropsWithChildren): ReactElement {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/booking/${sessionId}/passengers`]}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { draft, wrapper: Wrapper };
}
beforeEach(() => mockDb.reset());
afterEach(() => {
  clients.splice(0).forEach((c) => c.clear());
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
});
describe("passenger save ownership and navigation", () => {
  it("locks synchronous duplicate submits, persists only success and navigates with original session", async () => {
    const state = await setup();
    const before = useBookingDraftStore.getState().draft;
    let count = 0;
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/passengers", async () => {
        count++;
        await held;
        return undefined;
      }),
    );
    const { result } = renderHook(
      () => ({ ...useReplacePassengers(state.draft), location: useLocation() }),
      { wrapper: state.wrapper },
    );
    act(() => {
      result.current.submit(VALUES);
      result.current.submit(VALUES);
    });
    await waitFor(() => expect(count).toBe(1));
    expect(result.current.isPending).toBe(true);
    expect(useBookingDraftStore.getState().draft).toBe(before);
    release();
    await waitFor(() =>
      expect(result.current.location.pathname).toBe(
        `/booking/${state.draft.sessionId}/review`,
      ),
    );
    expect(useBookingDraftStore.getState().draft).toMatchObject({
      ...VALUES,
      expiresAt: state.draft.expiresAt,
      totalVnd: state.draft.totalVnd,
    });
  });
  it("keeps prior draft/storage on safe failure and permits an intentional retry", async () => {
    const state = await setup();
    const before = useBookingDraftStore.getState().draft;
    const storage = sessionStorage.getItem("blue-booking-draft");
    let count = 0;
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/passengers", () =>
        ++count === 1
          ? HttpResponse.json({ detail: "PRIVATE" }, { status: 503 })
          : undefined,
      ),
    );
    const { result } = renderHook(() => useReplacePassengers(state.draft), {
      wrapper: state.wrapper,
    });
    act(() => result.current.submit(VALUES));
    await waitFor(() => expect(result.current.error?.code).toBe("HTTP_ERROR"));
    expect(useBookingDraftStore.getState().draft).toBe(before);
    expect(sessionStorage.getItem("blue-booking-draft")).toBe(storage);
    act(() => result.current.submit(VALUES));
    await waitFor(() =>
      expect(useBookingDraftStore.getState().draft?.contact).toEqual(
        VALUES.contact,
      ),
    );
    expect(count).toBe(2);
  });
  it.each([
    "tripId",
    "passengerCount",
    "expiresAt",
    "selection",
    "totalVnd",
    "bookingId",
  ])("rejects %s drift before store/navigation", async (field) => {
    const state = await setup();
    const source = { ...mockDb.sessions.get(state.draft.sessionId), ...VALUES };
    const changed =
      field === "selection"
        ? {
            ...source,
            selectedSeatIds: [`${TRIP}:A01`, `${TRIP}:A03`],
            passengers: [VALUES.passengers[0]],
          }
        : field === "tripId"
          ? { ...source, tripId: "other" }
          : field === "passengerCount"
            ? { ...source, passengerCount: 3 }
            : field === "expiresAt"
              ? {
                  ...source,
                  expiresAt: new Date(
                    Date.parse(state.draft.expiresAt) + 60000,
                  ).toISOString(),
                }
              : field === "totalVnd"
                ? { ...source, totalVnd: 1 }
                : { ...source, bookingId: "unexpected" };
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/passengers", () =>
        HttpResponse.json(changed),
      ),
    );
    const { result } = renderHook(
      () => ({ ...useReplacePassengers(state.draft), location: useLocation() }),
      { wrapper: state.wrapper },
    );
    act(() => result.current.submit(VALUES));
    await waitFor(() =>
      expect(result.current.error?.code).toBe("INVALID_RESPONSE"),
    );
    expect(useBookingDraftStore.getState().draft).toBe(state.draft);
    expect(result.current.location.pathname).toContain("/passengers");
  });
  it.each(["success", "error", "cleared", "same-session-newer"])(
    "ignores stale %s after ownership changes",
    async (mode) => {
      const state = await setup();
      let release: () => void = () => undefined;
      let enter: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const entered = new Promise<void>((resolve) => {
        enter = resolve;
      });
      server.use(
        http.put("/api/v1/booking-sessions/:sessionId/passengers", async () => {
          enter();
          await held;
          return mode === "error"
            ? HttpResponse.json({}, { status: 503 })
            : undefined;
        }),
      );
      const { result } = renderHook(
        () => ({
          ...useReplacePassengers(state.draft),
          location: useLocation(),
        }),
        { wrapper: state.wrapper },
      );
      act(() => result.current.submit(VALUES));
      await entered;
      const next =
        mode === "cleared"
          ? null
          : {
              ...state.draft,
              sessionId:
                mode === "same-session-newer" ? state.draft.sessionId : "newer",
              totalVnd: 1,
            };
      if (next) useBookingDraftStore.getState().setDraft(next);
      else useBookingDraftStore.getState().clearDraft();
      const current = useBookingDraftStore.getState().draft;
      release();
      await waitFor(() => expect(result.current.isPending).toBe(false));
      expect(useBookingDraftStore.getState().draft).toBe(current);
      expect(result.current.location.pathname).toContain("/passengers");
      expect(result.current.error).toBeNull();
    },
  );
  it("rejects stale seat IDs before network and aborts a submitted request on unmount", async () => {
    const state = await setup();
    const calls = vi.fn();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/passengers", async () => {
        calls();
        await held;
        return undefined;
      }),
    );
    const { result, unmount } = renderHook(
      () => useReplacePassengers(state.draft),
      { wrapper: state.wrapper },
    );
    act(() =>
      result.current.submit({
        ...VALUES,
        passengers: [
          { ...VALUES.passengers[0], seatId: "foreign" },
          VALUES.passengers[1],
        ],
      }),
    );
    await waitFor(() =>
      expect(result.current.error?.code).toBe("VALIDATION_ERROR"),
    );
    expect(calls).not.toHaveBeenCalled();
    act(() => result.current.submit(VALUES));
    await waitFor(() => expect(calls).toHaveBeenCalledOnce());
    unmount();
    release();
    expect(useBookingDraftStore.getState().draft).toBe(state.draft);
  });
});
