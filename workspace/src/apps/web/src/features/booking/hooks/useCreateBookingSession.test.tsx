import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { PropsWithChildren, ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCreateBookingSession } from "@/features/booking/hooks/useCreateBookingSession";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { server } from "@/mocks/server";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import type { BookingSession } from "@/features/booking/types/booking";
import { mockDb } from "@/mocks/state/mockDb";

const TRIP = "trip-hcm-dalat-early";
const clients: QueryClient[] = [];
function wrapper({ children }: PropsWithChildren): ReactElement {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  clients.push(client);
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/trips"]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}
function payload(tripId = TRIP): BookingSession {
  return {
    passengerCount: 2,
    sessionId: "session-safe",
    tripId,
    selectedSeatIds: [],
    passengers: [],
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    totalVnd: 0,
    status: "active",
  };
}
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
});

describe("create booking mutation", () => {
  it("locks synchronously against rapid duplicate/cross-card requests and stores before canonical navigation", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requests = 0;
    server.use(
      http.post("/api/v1/booking-sessions", async () => {
        requests++;
        await gate;
        return HttpResponse.json(payload(), { status: 201 });
      }),
    );
    const { result } = renderHook(
      () => ({ booking: useCreateBookingSession(), location: useLocation() }),
      { wrapper },
    );
    act(() => {
      result.current.booking.createSession(TRIP, 2);
      result.current.booking.createSession(TRIP, 2);
      result.current.booking.createSession("trip-hcm-dalat-cabin", 2);
    });
    await waitFor(() => expect(requests).toBe(1));
    expect(result.current.booking.isPending).toBe(true);
    expect(result.current.booking.pendingTripId).toBe(TRIP);
    release();
    await waitFor(() =>
      expect(result.current.location.pathname).toBe(
        "/booking/session-safe/seats",
      ),
    );
    expect(useBookingDraftStore.getState().draft).toMatchObject({
      sessionId: "session-safe",
      tripId: TRIP,
    });
    expect(useBookingDraftStore.getState().draft).not.toHaveProperty("status");
  });
  it("preserves draft on failure and reuses the same key for explicit retry", async () => {
    const prior = { ...payload(), sessionId: "prior" };
    useBookingDraftStore.getState().setDraft(prior);
    const keys: (string | null)[] = [];
    server.use(
      http.post("/api/v1/booking-sessions", ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return keys.length === 1
          ? HttpResponse.json({ detail: "PRIVATE" }, { status: 503 })
          : HttpResponse.json(payload(), { status: 201 });
      }),
    );
    const { result } = renderHook(
      () => ({ booking: useCreateBookingSession(), location: useLocation() }),
      { wrapper },
    );
    act(() => result.current.booking.createSession(TRIP, 2));
    await waitFor(() =>
      expect(result.current.booking.error).toMatchObject({
        code: "HTTP_ERROR",
        canRetry: true,
      }),
    );
    expect(result.current.location.pathname).toBe("/trips");
    expect(useBookingDraftStore.getState().draft?.sessionId).toBe("prior");
    act(() => result.current.booking.retry());
    await waitFor(() =>
      expect(result.current.location.pathname).toBe(
        "/booking/session-safe/seats",
      ),
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
  it("rotates key for an intentional different trip and aborts request on unmount", async () => {
    const keys: (string | null)[] = [];
    let signal: AbortSignal | undefined;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post("/api/v1/booking-sessions", async ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        if (keys.length === 1) return HttpResponse.error();
        signal = request.signal;
        await gate;
        return HttpResponse.json(payload("trip-hcm-dalat-cabin"), {
          status: 201,
        });
      }),
    );
    const { result, unmount } = renderHook(() => useCreateBookingSession(), {
      wrapper,
    });
    act(() => result.current.createSession(TRIP, 2));
    await waitFor(() =>
      expect(result.current.error?.code).toBe("NETWORK_ERROR"),
    );
    act(() => result.current.createSession("trip-hcm-dalat-cabin", 2));
    await waitFor(() => expect(signal).toBeDefined());
    expect(keys[0]).not.toBe(keys[1]);
    unmount();
    expect(signal?.aborted).toBe(true);
    release();
    expect(useBookingDraftStore.getState().draft).toBeNull();
  });
});

it("ignores a late successful repository result after unmount without overwriting a newer draft", async () => {
  let resolve: (value: BookingSession) => void = () => undefined;
  const held = new Promise<BookingSession>((done) => {
    resolve = done;
  });
  const spy = vi
    .spyOn(httpBookingRepository, "createSession")
    .mockReturnValue(held);
  const { result, unmount } = renderHook(() => useCreateBookingSession(), {
    wrapper,
  });
  act(() => result.current.createSession(TRIP, 2));
  await waitFor(() => expect(spy).toHaveBeenCalledOnce());
  unmount();
  useBookingDraftStore
    .getState()
    .setDraft({ ...payload(), sessionId: "newer-draft" });
  await act(async () => {
    resolve(payload());
    await held;
  });
  expect(useBookingDraftStore.getState().draft?.sessionId).toBe("newer-draft");
  expect(spy.mock.calls[0]?.[2]?.signal?.aborted).toBe(true);
  spy.mockRestore();
});
