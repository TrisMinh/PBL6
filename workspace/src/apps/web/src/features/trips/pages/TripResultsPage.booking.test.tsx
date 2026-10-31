import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

import { BookingSessionRoute } from "@/app/guards/BookingSessionRoute";
import {
  createBookingDraftStore,
  useBookingDraftStore,
} from "@/features/booking/store/bookingDraftStore";
import type { BookingSession } from "@/features/booking/types/booking";
import { TripResultsPage } from "@/features/trips/pages/TripResultsPage";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { server } from "@/mocks/server";
import { mockDb } from "@/mocks/state/mockDb";

const CORE =
  "originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2";
const clients: QueryClient[] = [];
function Destination(): ReactElement {
  return <h1>Chọn ghế thử nghiệm</h1>;
}
function renderResults(): ReturnType<typeof createMemoryRouter> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: "/trips", element: <TripResultsPage /> },
      {
        element: <BookingSessionRoute />,
        children: [
          { path: "/booking/:sessionId/seats", element: <Destination /> },
        ],
      },
    ],
    { initialEntries: [`/trips?${CORE}`] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
function responseSession(): BookingSession {
  return {
    passengerCount: 2,
    sessionId: "session-start",
    tripId: "trip-hcm-dalat-early",
    selectedSeatIds: [],
    passengers: [],
    totalVnd: 0,
    status: "active",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  };
}
beforeEach(() => {
  mockDb.reset();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  useBookingDraftStore.getState().clearDraft();
  vi.unstubAllGlobals();
});

describe("Results booking start", () => {
  it.each([
    {
      index: 0,
      id: "trip-hcm-dalat-early",
      fare: 320_000,
      departure: "2099-01-01T00:00:00Z",
      arrival: "2099-01-01T06:30:00Z",
      available: 6,
      vehicleType: "cabin-22",
    },
    {
      index: 1,
      id: "trip-hcm-dalat-cabin",
      fare: 280_000,
      departure: "2099-01-01T01:00:00Z",
      arrival: "2099-01-01T07:15:00Z",
      available: 12,
      vehicleType: "sleeper-34",
    },
  ] as const)(
    "keeps card and booking contract identical for $id",
    async ({ index, id, fare, departure, arrival, available, vehicleType }) => {
      renderResults();
      await screen.findByText("24 chuyến phù hợp");
      const card = screen.getAllByRole("article")[index];
      if (!card) throw new Error(`Missing result card ${id}`);
      expect(card).toHaveAttribute("id", `trip-${id}`);
      expect(card).toHaveAttribute("data-vehicle-type", vehicleType);
      expect(
        within(card).getByText(
          new RegExp(formatCurrencyVnd(fare).replace(/\D/g, "\\D*")),
        ),
      ).toBeVisible();
      expect(within(card).getByText(`Còn ${available} ghế`)).toBeVisible();
      const times = card.querySelectorAll("time");
      expect(times[0]).toHaveAttribute("datetime", departure);
      expect(times[1]).toHaveAttribute("datetime", arrival);

      await userEvent.click(
        within(card).getByRole("button", { name: "Chọn chuyến" }),
      );
      await screen.findByRole("heading", { name: "Chọn ghế thử nghiệm" });
      const session = [...mockDb.sessions.values()][0];
      expect(session).toMatchObject({ tripId: id, passengerCount: 2 });
      const selectedTrip = mockDb.trips.find((trip) => trip.id === id);
      expect(selectedTrip).toMatchObject({
        fareVnd: fare,
        departureTime: departure,
        arrivalTime: arrival,
        availableSeatCount: available,
        vehicleType,
      });
      expect(
        mockDb.seats.get(id)?.filter((seat) => seat.status === "available"),
      ).toHaveLength(available);
    },
  );

  it("blocks rapid/cross-card clicks and keyed-list remount, then stores before guarded navigation", async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let count = 0;
    server.use(
      http.post("/api/v1/booking-sessions", async () => {
        count++;
        await held;
        return HttpResponse.json(responseSession(), { status: 201 });
      }),
    );
    const router = renderResults();
    await screen.findByText("24 chuyến phù hợp");
    const buttons = screen.getAllByRole("button", { name: "Chọn chuyến" });
    await userEvent.dblClick(buttons[0] ?? document.body);
    await waitFor(() => expect(count).toBe(1));
    expect(screen.getByRole("button", { name: "Đang xử lý" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(
      screen
        .getAllByRole("article")
        .every((card) =>
          within(card).getByRole("button").hasAttribute("disabled"),
        ),
    ).toBe(true);
    await userEvent.click(buttons[1] ?? document.body);
    await userEvent.selectOptions(screen.getByLabelText("Loại xe"), "cabin-22");
    await screen.findByText("24 kết quả");
    for (const button of screen.getAllByRole("button", { name: "Chọn chuyến" }))
      expect(button).toBeDisabled();
    expect(count).toBe(1);
    release();
    expect(
      await screen.findByRole("heading", { name: "Chọn ghế thử nghiệm" }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/booking/session-start/seats");
    expect(useBookingDraftStore.getState().draft).toMatchObject({
      sessionId: "session-start",
      tripId: "trip-hcm-dalat-early",
    });
    expect(useBookingDraftStore.getState().draft).not.toHaveProperty("status");
  });
  it("shows a safe accessible failure, keeps prior draft and retries with the same key", async () => {
    const prior = { ...responseSession(), sessionId: "prior-session" };
    useBookingDraftStore.getState().setDraft(prior);
    const before = useBookingDraftStore.getState().draft;
    const saved = sessionStorage.getItem("blue-booking-draft");
    const keys: (string | null)[] = [];
    server.use(
      http.post("/api/v1/booking-sessions", ({ request }) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return keys.length === 1
          ? HttpResponse.json({ detail: "PRIVATE_SERVER" }, { status: 503 })
          : HttpResponse.json(responseSession(), { status: 201 });
      }),
    );
    const router = renderResults();
    await screen.findByText("24 chuyến phù hợp");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Chọn chuyến" })[0] ??
        document.body,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chưa thể bắt đầu đặt vé",
    );
    expect(document.body).not.toHaveTextContent("PRIVATE_SERVER");
    expect(keys).toHaveLength(1);
    expect(router.state.location.pathname).toBe("/trips");
    expect(useBookingDraftStore.getState().draft).toBe(before);
    expect(sessionStorage.getItem("blue-booking-draft")).toBe(saved);
    await userEvent.click(
      screen.getByRole("button", { name: "Thử lại đặt vé" }),
    );
    await screen.findByRole("heading", { name: "Chọn ghế thử nghiệm" });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
  it("never posts sold-out selection and rejects malformed success before changing draft/navigation", async () => {
    let count = 0;
    server.use(
      http.post("/api/v1/booking-sessions", () => {
        count++;
        return HttpResponse.json({ secret: "PRIVATE_DRIFT" }, { status: 201 });
      }),
    );
    const router = renderResults();
    await screen.findByText("24 chuyến phù hợp");
    await userEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    const sold = within(
      screen.getAllByRole("article")[0] ?? document.body,
    ).getByRole("button", { name: "Chọn chuyến" });
    expect(sold).toBeDisabled();
    await userEvent.click(sold);
    expect(count).toBe(0);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Chọn chuyến" })[1] ??
        document.body,
    );
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(document.body).not.toHaveTextContent("PRIVATE_DRIFT");
    expect(router.state.location.pathname).toBe("/trips");
    expect(useBookingDraftStore.getState().draft).toBeNull();
  });
});

it("offers search recovery without retrying a nonretryable creation error", async () => {
  server.use(
    http.post("/api/v1/booking-sessions", () =>
      HttpResponse.json({ detail: "PRIVATE" }, { status: 410 }),
    ),
  );
  const router = renderResults();
  await screen.findByText("24 chuyến phù hợp");
  await userEvent.click(
    screen.getAllByRole("button", { name: "Chọn chuyến" })[0] ?? document.body,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("sửa tìm kiếm");
  expect(
    screen.queryByRole("button", { name: "Thử lại đặt vé" }),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole("alert")).getByRole("link", {
      name: "Sửa tìm kiếm",
    }),
  ).toHaveAttribute("href", "/");
  expect(router.state.location.pathname).toBe("/trips");
});

it("persists the canonical search passenger count through session creation and fresh hydration", async () => {
  renderResults();
  await screen.findByText("24 chuyến phù hợp");
  await userEvent.click(
    screen.getAllByRole("button", { name: "Chọn chuyến" })[0] ?? document.body,
  );
  await screen.findByRole("heading", { name: "Chọn ghế thử nghiệm" });
  expect(useBookingDraftStore.getState().draft).toHaveProperty(
    "passengerCount",
    2,
  );
  const restored = createBookingDraftStore();
  await restored.persist.rehydrate();
  expect(restored.getState().draft).toHaveProperty("passengerCount", 2);
  expect(restored.getState().draft?.expiresAt).toBe(
    useBookingDraftStore.getState().draft?.expiresAt,
  );
});
