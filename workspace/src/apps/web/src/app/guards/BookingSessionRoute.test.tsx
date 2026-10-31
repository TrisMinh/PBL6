import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createJSONStorage } from "zustand/middleware";

import { BookingSessionRoute } from "@/app/guards/BookingSessionRoute";
import {
  BOOKING_DRAFT_STORAGE_KEY,
  useBookingDraftStore,
} from "@/features/booking/store/bookingDraftStore";
import type { BookingDraft } from "@/features/booking/types/booking";

function createDraft(overrides: Partial<BookingDraft> = {}): BookingDraft {
  return {
    passengerCount: 2,
    sessionId: "session-1",
    tripId: "test-trip",
    selectedSeatIds: [],
    passengers: [],
    totalVnd: 0,
    expiresAt: "2099-01-01T00:00:00Z",
    ...overrides,
  };
}

const defaultStorage = useBookingDraftStore.persist.getOptions().storage;

afterEach(() => {
  useBookingDraftStore.persist.setOptions({ storage: defaultStorage });
  useBookingDraftStore.getState().clearDraft();
  vi.useRealTimers();
});

function renderBookingGuard(
  path = "/booking/session-1/seats",
): ReturnType<typeof createMemoryRouter> {
  const router = createMemoryRouter(
    [
      {
        element: <BookingSessionRoute />,
        children: [
          {
            path: "/booking/:sessionId/seats",
            element: <h1>Chọn ghế được bảo vệ</h1>,
          },
          {
            path: "/booking/:sessionId/passengers",
            element: <h1>Hành khách được bảo vệ</h1>,
          },
          { path: "/booking", element: <h1>Phiên trống</h1> },
          {
            path: "/payment/:bookingId/vnpay",
            element: <h1>Thanh toán được bảo vệ</h1>,
          },
        ],
      },
      { path: "/trips", element: <h1>Tìm chuyến</h1> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("BookingSessionRoute", () => {
  it("BookingSessionRoute late hydration does not reopen a route after navigating away", async () => {
    let resolveRead: ((value: string | null) => void) | undefined;
    const pending = new Promise<string | null>((resolve) => {
      resolveRead = resolve;
    });
    useBookingDraftStore.persist.setOptions({
      storage: createJSONStorage(() => ({
        getItem: () => pending,
        setItem: () => undefined,
        removeItem: () => undefined,
      })),
    });
    const router = renderBookingGuard();
    await act(async () => {
      await router.navigate("/trips");
    });
    await act(async () => {
      resolveRead?.(
        JSON.stringify({ state: { draft: createDraft() }, version: 0 }),
      );
    });
    expect(screen.getByRole("heading", { name: "Tìm chuyến" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/trips");
  });

  it("BookingSessionRoute remains loading while async persisted storage is unresolved", async () => {
    let resolveRead: ((value: string | null) => void) | undefined;
    const pending = new Promise<string | null>((resolve) => {
      resolveRead = resolve;
    });
    useBookingDraftStore.persist.setOptions({
      storage: createJSONStorage(() => ({
        getItem: () => pending,
        setItem: () => undefined,
        removeItem: () => undefined,
      })),
    });
    const router = renderBookingGuard();
    expect(screen.getByRole("status")).toHaveTextContent("Đang kiểm tra phiên");
    expect(router.state.location.pathname).toBe("/booking/session-1/seats");
    await act(async () => {
      resolveRead?.(
        JSON.stringify({ state: { draft: createDraft() }, version: 0 }),
      );
    });
    expect(
      await screen.findByRole("heading", { name: "Chọn ghế được bảo vệ" }),
    ).toBeVisible();
  });

  it("BookingSessionRoute refresh waits for the persisted draft before deciding access", async () => {
    sessionStorage.setItem(
      BOOKING_DRAFT_STORAGE_KEY,
      JSON.stringify({
        state: {
          draft: createDraft(),
        },
        version: 0,
      }),
    );
    const router = renderBookingGuard();
    expect(
      await screen.findByRole("heading", { name: "Chọn ghế được bảo vệ" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/booking/session-1/seats");
  });

  it("BookingSessionRoute permits payment only when the draft bookingId matches", async () => {
    const draft = createDraft({
      sessionId: "session-1",
      bookingId: "booking-1",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    useBookingDraftStore.getState().setDraft(draft);
    renderBookingGuard("/payment/booking-1/vnpay");
    expect(
      await screen.findByRole("heading", { name: "Thanh toán được bảo vệ" }),
    ).toBeVisible();
  });

  it.each([undefined, "other-booking"])(
    "BookingSessionRoute rejects payment with draft bookingId %s",
    async (bookingId) => {
      const draft = createDraft({
        sessionId: "session-1",
        bookingId,
        expiresAt: "2099-01-01T00:00:00Z",
      });
      useBookingDraftStore.getState().setDraft(draft);
      const router = renderBookingGuard("/payment/booking-1/vnpay");
      expect(
        await screen.findByRole("heading", { name: "Tìm chuyến" }),
      ).toBeVisible();
      expect(router.state.location.search).toBe("?reason=expired");
    },
  );

  it("BookingSessionRoute initial render does not access sessionStorage", () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    const html = renderToString(
      <MemoryRouter>
        <BookingSessionRoute />
      </MemoryRouter>,
    );
    expect(html).toContain("Đang kiểm tra phiên");
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    { name: "missing", draft: null },
    {
      name: "mismatched",
      draft: { sessionId: "other-session", expiresAt: "2099-01-01T00:00:00Z" },
    },
    {
      name: "invalid expiry",
      draft: { sessionId: "session-1", expiresAt: "not-a-date" },
    },
  ])(
    "BookingSessionRoute with $name draft redirects to expired recovery",
    async ({ draft }) => {
      if (draft) useBookingDraftStore.getState().setDraft(createDraft(draft));
      const router = renderBookingGuard();
      expect(
        await screen.findByRole("heading", { name: "Tìm chuyến" }),
      ).toBeVisible();
      expect(
        router.state.location.pathname + router.state.location.search,
      ).toBe("/trips?reason=expired");
      expect(
        screen.queryByRole("heading", { name: "Chọn ghế được bảo vệ" }),
      ).not.toBeInTheDocument();
    },
  );

  it("BookingSessionRoute without a route sessionId redirects to recovery", async () => {
    useBookingDraftStore.getState().setDraft(createDraft());
    const router = renderBookingGuard("/booking");
    expect(
      await screen.findByRole("heading", { name: "Tìm chuyến" }),
    ).toBeVisible();
    expect(router.state.location.search).toBe("?reason=expired");
  });

  it("BookingSessionRoute for a matching valid session renders its outlet", async () => {
    useBookingDraftStore.getState().setDraft(createDraft());
    renderBookingGuard();
    expect(
      await screen.findByRole("heading", { name: "Chọn ghế được bảo vệ" }),
    ).toBeVisible();
  });

  it("keeps only the matching seat route mounted when the hold expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T00:00:00Z"));
    useBookingDraftStore
      .getState()
      .setDraft(createDraft({ expiresAt: "2026-10-19T00:00:01Z" }));
    const router = renderBookingGuard();
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      screen.getByRole("heading", { name: "Chọn ghế được bảo vệ" }),
    ).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(
      screen.getByRole("heading", { name: "Chọn ghế được bảo vệ" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/booking/session-1/seats");
  });

  it("still redirects an expired matching passenger route", async () => {
    useBookingDraftStore
      .getState()
      .setDraft(createDraft({ expiresAt: "2000-01-01T00:00:00Z" }));
    const router = renderBookingGuard("/booking/session-1/passengers");
    expect(
      await screen.findByRole("heading", { name: "Tìm chuyến" }),
    ).toBeVisible();
    expect(router.state.location.search).toBe("?reason=expired");
  });

  it("BookingSessionRoute reacts when the booking draft is cleared", async () => {
    useBookingDraftStore.getState().setDraft(createDraft());
    renderBookingGuard();
    await act(async () => useBookingDraftStore.getState().clearDraft());
    expect(
      await screen.findByRole("heading", { name: "Tìm chuyến" }),
    ).toBeVisible();
  });
});
