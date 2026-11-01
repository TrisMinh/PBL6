import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { useEffect, type ReactElement } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { BookingSessionRoute } from "@/app/guards/BookingSessionRoute";
import { PassengerDetailsPage } from "@/features/booking/pages/PassengerDetailsPage";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import {
  createBookingDraftStore,
  useBookingDraftStore,
} from "@/features/booking/store/bookingDraftStore";
import type { BookingDraft } from "@/features/booking/types/booking";
import { TripResultsPage } from "@/features/trips/pages/TripResultsPage";
import { server } from "@/mocks/server";
import { mockDb } from "@/mocks/state/mockDb";
import { createBookingHandlers } from "@/mocks/handlers/bookingHandlers";

const TRIP = "trip-hcm-dalat-early";
const clients: QueryClient[] = [];
let reviewed: BookingDraft | null = null;
function ReviewTarget(): ReactElement {
  useEffect(() => {
    reviewed = useBookingDraftStore.getState().draft;
  }, []);
  return <h1>Kiểm tra đơn</h1>;
}
async function setup(selected = true): Promise<BookingDraft> {
  const created = await httpBookingRepository.createSession(TRIP, 2);
  const session = selected
    ? await httpBookingRepository.replaceSeats(created.sessionId, [
        `${TRIP}:A01`,
        `${TRIP}:A02`,
      ])
    : created;
  useBookingDraftStore.getState().setDraft(session);
  const draft = useBookingDraftStore.getState().draft;
  if (!draft) throw new Error("Expected draft");
  return draft;
}
function show(draft: BookingDraft): ReturnType<typeof createMemoryRouter> {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  const router = createMemoryRouter(
    [
      {
        element: <BookingSessionRoute />,
        children: [
          {
            path: "/booking/:sessionId/passengers",
            element: <PassengerDetailsPage />,
          },
          { path: "/booking/:sessionId/review", element: <ReviewTarget /> },
          { path: "/booking/:sessionId/seats", element: <h1>Chọn ghế</h1> },
        ],
      },
      { path: "/trips", element: <TripResultsPage /> },
      { path: "/", element: <h1>Tìm chuyến</h1> },
    ],
    { initialEntries: [`/booking/${draft.sessionId}/passengers`] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
async function fill(): Promise<void> {
  await userEvent.type(
    await screen.findByLabelText("Họ và tên (ghế A01)"),
    "  Khách Một  ",
  );
  await userEvent.type(
    screen.getByLabelText("Họ và tên (ghế A02)"),
    "  Khách Hai  ",
  );
  await userEvent.type(
    screen.getByLabelText("Họ và tên người liên hệ"),
    "  Khách Liên Hệ  ",
  );
  await userEvent.type(
    screen.getByLabelText("Email nhận vé"),
    "test+mock@example.invalid",
  );
  await userEvent.type(
    screen.getByLabelText("Số điện thoại người liên hệ"),
    "0912345678",
  );
}
beforeEach(() => {
  reviewed = null;
  mockDb.reset();
  server.use(...createBookingHandlers({ now: () => Date.now() }));
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
  vi.restoreAllMocks();
});
describe("passenger details integration", () => {
  it("retains entered values when a background layout check fails, then retries", async () => {
    const draft = await setup();
    show(draft);
    await fill();
    let failed = true;
    server.use(
      http.get("/api/v1/trips/:tripId/seats", () =>
        failed
          ? HttpResponse.json({ detail: "PRIVATE_PAYLOAD" }, { status: 503 })
          : undefined,
      ),
    );
    await act(async () => {
      await clients.at(-1)?.invalidateQueries();
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chưa thể kiểm tra lại chuyến đi",
    );
    expect(screen.getByLabelText("Họ và tên (ghế A01)")).toHaveValue(
      "  Khách Một  ",
    );
    expect(screen.getByLabelText("Email nhận vé")).toBeDisabled();
    failed = false;
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Email nhận vé")).toBeEnabled(),
    );
    expect(screen.getByLabelText("Họ và tên (ghế A01)")).toHaveValue(
      "  Khách Một  ",
    );
  });
  it("retries a safe initial layout failure without rendering untrusted fields", async () => {
    const draft = await setup();
    let count = 0;
    server.use(
      http.get("/api/v1/trips/:tripId/seats", () =>
        ++count === 1
          ? HttpResponse.json({ detail: "PRIVATE_PAYLOAD" }, { status: 503 })
          : undefined,
      ),
    );
    show(draft);
    await screen.findByRole("heading", {
      name: "Không thể tải thông tin chuyến đi",
    });
    expect(screen.queryByLabelText("Email nhận vé")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("PRIVATE_PAYLOAD");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByLabelText("Email nhận vé")).toBeVisible();
  });
  it("renders trusted seat codes/contact/pickup and blocks invalid submit before network", async () => {
    const draft = await setup();
    const calls = vi.fn();
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/passengers", () => {
        calls();
        return undefined;
      }),
    );
    show(draft);
    expect(
      await screen.findByRole("group", {
        name: "Ghế A01 · Thông tin hành khách",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Ghế A02 · Thông tin hành khách" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Vị trí đón")).toHaveValue(
      "Miền Đông mới · Có mặt 06:40",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Xác nhận thông tin" }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(1),
    );
    expect(calls).not.toHaveBeenCalled();
  });
  it("locks double submit, stores canonical values before review and keeps PII out of URL/logs", async () => {
    const draft = await setup();
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
    const logs = vi.spyOn(console, "log");
    const errors = vi.spyOn(console, "error");
    const router = show(draft);
    await fill();
    const owner = useBookingDraftStore.getState().draft;
    await userEvent.dblClick(
      screen.getByRole("button", { name: "Xác nhận thông tin" }),
    );
    await waitFor(() => expect(count).toBe(1));
    for (const control of screen.getAllByRole("textbox"))
      expect(control).toBeDisabled();
    expect(useBookingDraftStore.getState().draft).toBe(owner);
    release();
    await screen.findByRole("heading", { name: "Kiểm tra đơn" });
    expect(reviewed?.contact?.fullName).toBe("Khách Liên Hệ");
    expect(reviewed?.passengers.map((p) => p.fullName)).toEqual([
      "Khách Một",
      "Khách Hai",
    ]);
    expect(reviewed?.expiresAt).toBe(draft.expiresAt);
    expect(router.state.location.search).toBe("");
    expect(router.state.location.hash).toBe("");
    expect(
      JSON.stringify([...logs.mock.calls, ...errors.mock.calls]),
    ).not.toMatch(/mock@example|0912345678|Khách Liên Hệ/);
  });
  it("preserves entered values and prior draft on failure, then retries safely", async () => {
    const draft = await setup();
    let count = 0;
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/passengers", () =>
        ++count === 1
          ? HttpResponse.json({ detail: "PRIVATE_PAYLOAD" }, { status: 503 })
          : undefined,
      ),
    );
    show(draft);
    await fill();
    const owner = useBookingDraftStore.getState().draft;
    await userEvent.click(
      screen.getByRole("button", { name: "Xác nhận thông tin" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chưa thể lưu thông tin",
    );
    expect(document.body).not.toHaveTextContent("PRIVATE_PAYLOAD");
    expect(screen.getByLabelText("Họ và tên (ghế A01)")).toHaveValue(
      "  Khách Một  ",
    );
    expect(useBookingDraftStore.getState().draft).toBe(owner);
    await userEvent.click(
      screen.getByRole("button", { name: "Xác nhận thông tin" }),
    );
    await screen.findByRole("heading", { name: "Kiểm tra đơn" });
    expect(count).toBe(2);
  });
  it("restores saved values after hydration and back navigation without extending expiry", async () => {
    const draft = await setup();
    const saved = await httpBookingRepository.replacePassengers(
      draft.sessionId,
      {
        fullName: "Khách Liên Hệ",
        email: "test+mock@example.invalid",
        phone: "0912345678",
      },
      [
        { seatId: `${TRIP}:A02`, fullName: "Khách Hai" },
        { seatId: `${TRIP}:A01`, fullName: "Khách Một" },
      ],
    );
    useBookingDraftStore.getState().setDraft(saved);
    const restored = createBookingDraftStore();
    await restored.persist.rehydrate();
    useBookingDraftStore.setState({ draft: restored.getState().draft });
    const router = show(saved);
    expect(await screen.findByLabelText("Họ và tên (ghế A01)")).toHaveValue(
      "Khách Một",
    );
    expect(screen.getByLabelText("Họ và tên (ghế A02)")).toHaveValue(
      "Khách Hai",
    );
    expect(screen.getByLabelText("Email nhận vé")).toHaveValue(
      "test+mock@example.invalid",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Xác nhận thông tin" }),
    );
    await screen.findByRole("heading", { name: "Kiểm tra đơn" });
    await act(() => router.navigate(-1));
    expect(await screen.findByLabelText("Họ và tên (ghế A01)")).toHaveValue(
      "Khách Một",
    );
    expect(useBookingDraftStore.getState().draft?.expiresAt).toBe(
      draft.expiresAt,
    );
  });
  it.each(["empty", "foreign", "sold"])(
    "fails closed for %s selection with a seat recovery link",
    async (mode) => {
      const draft = await setup(mode !== "empty");
      if (mode === "foreign")
        useBookingDraftStore
          .getState()
          .replaceSeats([`${TRIP}:A99`, `${TRIP}:A02`], draft.totalVnd);
      if (mode === "sold") {
        const seat = mockDb.seats.get(TRIP)?.find((s) => s.code === "A01");
        if (seat) seat.status = "sold";
      }
      show(draft);
      expect(
        await screen.findByRole("heading", { name: "Vui lòng chọn lại ghế" }),
      ).toBeVisible();
      expect(screen.queryByLabelText("Email nhận vé")).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Quay lại chọn ghế" }),
      ).toHaveAttribute("href", `/booking/${draft.sessionId}/seats`);
    },
  );
  it("uses the existing safe expired recovery on HOLD_EXPIRED and clock expiry", async () => {
    const draft = await setup();
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/passengers", () =>
        HttpResponse.json({ code: "HOLD_EXPIRED" }, { status: 410 }),
      ),
    );
    const router = show(draft);
    await fill();
    await userEvent.click(
      screen.getByRole("button", { name: "Xác nhận thông tin" }),
    );
    await screen.findByRole("heading", { name: "Phiên giữ chỗ đã hết hạn" });
    expect(useBookingDraftStore.getState().draft).toBeNull();
    await waitFor(() => expect(router.state.location.pathname).toBe("/trips"));
    expect(router.state.location.search).toContain("passengerCount=2");
    expect(router.state.location.search).toContain("reason=expired");
    expect(
      screen.getByRole("link", { name: "Tìm lại chuyến" }),
    ).toHaveAttribute("href", expect.stringContaining("passengerCount=2"));
  });
  it("clears original hold when time elapses while entering details", async () => {
    const draft = await setup();
    show(draft);
    await screen.findByLabelText("Email nhận vé");
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(draft.expiresAt) + 1);
    act(() => window.dispatchEvent(new Event("focus")));
    await screen.findByRole("heading", { name: "Phiên giữ chỗ đã hết hạn" });
    expect(useBookingDraftStore.getState().draft).toBeNull();
    await waitFor(() =>
      expect(mockDb.sessions.get(draft.sessionId)?.status).toBe("expired"),
    );
  });
});
