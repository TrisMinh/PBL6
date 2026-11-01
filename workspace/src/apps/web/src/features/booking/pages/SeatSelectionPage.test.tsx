import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookingSession } from "@/features/booking/types/booking";
import { createBookingHandlers } from "@/mocks/handlers/bookingHandlers";
import { SeatSelectionPage } from "@/features/booking/pages/SeatSelectionPage";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import {
  createBookingDraftStore,
  useBookingDraftStore,
} from "@/features/booking/store/bookingDraftStore";
import { TripResultsPage } from "@/features/trips/pages/TripResultsPage";
import { server } from "@/mocks/server";
import { mockDb } from "@/mocks/state/mockDb";

const TRIP = "trip-hcm-dalat-cabin";
const clients: QueryClient[] = [];
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  mockDb.reset();
  server.use(...createBookingHandlers({ now: () => Date.now() }));
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function start(tripId = TRIP): Promise<BookingSession> {
  const session = await httpBookingRepository.createSession(tripId, 2);
  useBookingDraftStore.getState().setDraft(session);
  return session;
}
function show(entry: string): {
  router: ReturnType<typeof createMemoryRouter>;
  client: QueryClient;
  unmount: () => void;
} {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: "/booking/:sessionId/seats", element: <SeatSelectionPage /> },
      {
        path: "/booking/:sessionId/passengers",
        element: <h1>Thông tin hành khách</h1>,
      },
      { path: "/trips", element: <TripResultsPage /> },
      { path: "/", element: <h1>Tìm chuyến</h1> },
    ],
    { initialEntries: [entry] },
  );
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, client, ...view };
}
describe("seat selection page", () => {
  it("loads both decks, gates exact passenger count, commits and navigates to passengers", async () => {
    const session = await start();
    const { router } = show(`/booking/${session.sessionId}/seats`);
    expect(
      await screen.findByRole("heading", { name: "Chọn ghế của bạn" }),
    ).toBeVisible();
    const next = await screen.findByRole("button", { name: "Tiếp tục" });
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Ghế A01" }));
    await waitFor(() =>
      expect(
        useBookingDraftStore.getState().draft?.selectedSeatIds,
      ).toHaveLength(1),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ghế A02" })).toBeEnabled(),
    );
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Ghế A02" }));
    await waitFor(() => expect(next).toBeEnabled());
    expect(screen.getAllByText(/560.000/)).toHaveLength(2);
    await userEvent.click(next);
    expect(
      await screen.findByRole("heading", { name: "Thông tin hành khách" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(
      `/booking/${session.sessionId}/passengers`,
    );
  });
  it("rehydrates the original owned selection/count/expiry and allows deselection", async () => {
    const session = await start("trip-hcm-dalat-early");
    const selected = await httpBookingRepository.replaceSeats(
      session.sessionId,
      ["trip-hcm-dalat-early:A01", "trip-hcm-dalat-early:A02"],
    );
    useBookingDraftStore.getState().setDraft(selected);
    const restored = createBookingDraftStore();
    await restored.persist.rehydrate();
    useBookingDraftStore.setState({ draft: restored.getState().draft });
    show(`/booking/${session.sessionId}/seats`);
    expect(
      await screen.findByRole("heading", { name: "Chọn cabin của bạn" }),
    ).toBeVisible();
    const own = await screen.findByRole("button", { name: "Ghế A01" });
    expect(own).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(own);
    await waitFor(() =>
      expect(useBookingDraftStore.getState().draft?.selectedSeatIds).toEqual([
        "trip-hcm-dalat-early:A02",
      ]),
    );
    expect(useBookingDraftStore.getState().draft?.expiresAt).toBe(
      session.expiresAt,
    );
    expect(useBookingDraftStore.getState().draft?.passengerCount).toBe(2);
  });
  it("rolls back, announces trusted conflict codes, refetches, traps dialog and returns focus", async () => {
    const session = await start();
    let reads = 0;
    server.use(
      http.get("/api/v1/trips/:tripId/seats", () => {
        reads++;
        return undefined;
      }),
    );
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/seats", () => {
        const seat = mockDb.seats
          .get(TRIP)
          ?.find((seat) => seat.code === "A01");
        if (seat) seat.status = "sold";
        return HttpResponse.json(
          {
            code: "SEAT_CONFLICT",
            conflictingSeatIds: [`${TRIP}:A01`, "PRIVATE"],
            detail: "PRIVATE",
          },
          { status: 409 },
        );
      }),
    );
    show(`/booking/${session.sessionId}/seats`);
    const seat = await screen.findByRole("button", { name: "Ghế A01" });
    await userEvent.click(seat);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName(/A01/);
    expect(dialog).not.toHaveTextContent("PRIVATE");
    expect(useBookingDraftStore.getState().draft?.selectedSeatIds).toEqual([]);
    await waitFor(() => expect(reads).toBeGreaterThan(1));
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("region", { name: "Sơ đồ ghế hai tầng" }),
    ).toHaveFocus();
    expect(seat).toBeDisabled();
  });
  it("shows safe loading/error retry, and rolls back non-conflict failures", async () => {
    const session = await start();
    let first = true;
    server.use(
      http.get("/api/v1/trips/:tripId/seats", () => {
        if (!first) return undefined;
        first = false;
        return HttpResponse.json({ detail: "PRIVATE" }, { status: 503 });
      }),
    );
    show(`/booking/${session.sessionId}/seats`);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải");
    expect(
      await screen.findByRole("heading", { name: "Không thể tải sơ đồ ghế" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    const seat = await screen.findByRole("button", { name: "Ghế A01" });
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/seats", () =>
        HttpResponse.json({ detail: "PRIVATE" }, { status: 500 }),
      ),
    );
    await userEvent.click(seat);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chưa thể cập nhật ghế",
    );
    expect(document.body).not.toHaveTextContent("PRIVATE");
    expect(useBookingDraftStore.getState().draft?.selectedSeatIds).toEqual([]);
  });
  it("clears expired draft and recovers canonical search after HOLD_EXPIRED without a trips query", async () => {
    const session = await start();
    const requests = vi.fn();
    server.use(
      http.get("/api/v1/trips", () => {
        requests();
        return undefined;
      }),
      http.put("/api/v1/booking-sessions/:sessionId/seats", () =>
        HttpResponse.json({ code: "HOLD_EXPIRED" }, { status: 410 }),
      ),
    );
    const { router } = show(`/booking/${session.sessionId}/seats`);
    await userEvent.click(
      await screen.findByRole("button", { name: "Ghế A01" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Phiên giữ ghế đã hết hạn",
    });
    expect(dialog).toHaveTextContent("PHIÊN GIỮ GHẾ");
    expect(dialog).not.toHaveTextContent("THỜI GIAN GIỮ CHỖ");
    expect(dialog).toHaveTextContent("Ghế đã được trả về trạng thái trống");
    expect(dialog).toHaveTextContent("00:00");
    expect(router.state.location.pathname).toBe(
      `/booking/${session.sessionId}/seats`,
    );
    expect(useBookingDraftStore.getState().draft).not.toBeNull();
    const link = screen.getByRole("link", { name: "Kiểm tra lại chuyến" });
    expect(link).toHaveClass("seat-conflict__primary");
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("passengerCount=2"),
    );
    expect(
      screen.getByRole("link", { name: "Quay lại danh sách" }),
    ).toHaveAttribute("href", expect.stringContaining("passengerCount=2"));
    expect(requests).not.toHaveBeenCalled();
  });
  it("shows the exact six-seat limit dialog and keeps all selected seats", async () => {
    const session = await httpBookingRepository.createSession(TRIP, 6);
    const selected = await httpBookingRepository.replaceSeats(
      session.sessionId,
      ["A01", "A02", "A03", "A04", "A05", "A06"].map(
        (code) => `${TRIP}:${code}`,
      ),
    );
    useBookingDraftStore.getState().setDraft(selected);
    show(`/booking/${session.sessionId}/seats`);
    await userEvent.click(
      await screen.findByRole("button", { name: "Ghế A07" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Bạn đã chọn đủ 6 chỗ",
    });
    expect(dialog).toHaveTextContent("GIỚI HẠN ĐẶT CHỖ");
    expect(dialog).toHaveTextContent("6/6 chỗ đã chọn");
    expect(dialog).toHaveTextContent("Đã đạt giới hạn");
    expect(dialog.querySelector(".seat-conflict__state-icon")).toHaveClass(
      "seat-conflict__state-icon--limit",
    );
    expect(
      dialog.querySelector(".seat-conflict__status-detail--limit"),
    ).toHaveTextContent("Đã đạt giới hạn");
    expect(useBookingDraftStore.getState().draft?.selectedSeatIds).toHaveLength(
      6,
    );
  });
  it("bare guard expiry offers Home without querying incomplete search", async () => {
    const requests = vi.fn();
    server.use(
      http.get("/api/v1/trips", () => {
        requests();
        return undefined;
      }),
    );
    show("/trips?reason=expired");
    expect(
      await screen.findByRole("heading", { name: "Phiên giữ chỗ đã hết hạn" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Tìm lại chuyến" }),
    ).toHaveAttribute("href", "/");
    expect(requests).not.toHaveBeenCalled();
  });
  it("keeps the expired seat frame mounted until the passenger chooses recovery", async () => {
    const session = await start();
    const selected = await httpBookingRepository.replaceSeats(
      session.sessionId,
      [`${TRIP}:A01`],
    );
    useBookingDraftStore.getState().setDraft(selected);
    show(`/booking/${session.sessionId}/seats`);
    await screen.findByRole("button", { name: "Ghế A01" });
    const now = Date.parse(session.expiresAt) + 1;
    vi.spyOn(Date, "now").mockReturnValue(now);
    act(() => window.dispatchEvent(new Event("focus")));
    await screen.findByRole("dialog", { name: "Phiên giữ ghế đã hết hạn" });
    expect(useBookingDraftStore.getState().draft).not.toBeNull();
    await userEvent.click(
      screen.getByRole("link", { name: "Kiểm tra lại chuyến" }),
    );
    await waitFor(() =>
      expect(mockDb.sessions.get(session.sessionId)?.status).toBe("expired"),
    );
    expect(useBookingDraftStore.getState().draft).toBeNull();
  });
});
