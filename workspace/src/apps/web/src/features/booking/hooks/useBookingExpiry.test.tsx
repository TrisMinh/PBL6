import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { PropsWithChildren, ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { useBookingExpiry } from "@/features/booking/hooks/useBookingExpiry";
import { ExpiredBookingState } from "@/features/booking/components/ExpiredBookingState";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { server } from "@/mocks/server";
import { mockDb } from "@/mocks/state/mockDb";

function Wrapper({ children }: PropsWithChildren): ReactElement {
  return (
    <MemoryRouter initialEntries={["/booking/session/seats"]}>
      {children}
      <Routes>
        <Route path="/booking/session/seats" element={null} />
        <Route
          path="/trips"
          element={
            <ExpiredBookingState
              params={new URLSearchParams("reason=expired")}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
}
beforeEach(() => mockDb.reset());
afterEach(() => {
  mockDb.reset();
  useBookingDraftStore.getState().clearDraft();
});
it("recovery destination clears without trusted trip data even when cleanup is offline", async () => {
  const draft = await httpBookingRepository.createSession(
    "trip-hcm-dalat-early",
    2,
  );
  useBookingDraftStore.getState().setDraft(draft);
  const reads = vi.fn();
  server.use(
    http.get("/api/v1/trips/:tripId/seats", () => {
      reads();
      return HttpResponse.error();
    }),
  );
  const { result } = renderHook(
    () => {
      useBookingExpiry(draft, undefined, true);
      return useLocation();
    },
    { wrapper: Wrapper },
  );
  await waitFor(() => expect(result.current.pathname).toBe("/trips"));
  expect(result.current.search).toBe("?reason=expired");
  expect(useBookingDraftStore.getState().draft).toBeNull();
  await waitFor(() => expect(reads).toHaveBeenCalledOnce());
});
it("stale expiry never clears a newer session or starts cleanup", async () => {
  const old = await httpBookingRepository.createSession(
    "trip-hcm-dalat-early",
    2,
  );
  const newer = { ...old, sessionId: "newer" };
  useBookingDraftStore.getState().setDraft(newer);
  const reads = vi.fn();
  server.use(
    http.get("/api/v1/trips/:tripId/seats", () => {
      reads();
      return undefined;
    }),
  );
  const { result } = renderHook(
    () => {
      useBookingExpiry(old, undefined, true);
      return useLocation();
    },
    { wrapper: Wrapper },
  );
  expect(result.current.pathname).toBe("/booking/session/seats");
  expect(useBookingDraftStore.getState().draft?.sessionId).toBe("newer");
  expect(reads).not.toHaveBeenCalled();
});
