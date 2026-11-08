import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it, vi } from "vitest";

import { TripSeatsPage } from "./TripSeatsPage";
import { httpBookingRepository } from "../repositories/httpBookingRepository";
import { BookingRepositoryError } from "../repositories/bookingRepositoryError";
import { useBookingDraftStore } from "../store/bookingDraftStore";

vi.mock("@/shared/api/config", () => ({ isMockApi: false, apiBaseUrl: "" }));

const TRIP = "019b3000-0000-7000-8000-000000007001";
const clients: QueryClient[] = [];
function renderTrip(
  query = "",
  strict = false,
): ReturnType<typeof createMemoryRouter> {
  const client = new QueryClient();
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: "/", element: <h1>Trang chủ</h1> },
      { path: "/trips/:tripId/seats", element: <TripSeatsPage /> },
      { path: "/booking/:sessionId/seats", element: <h1>Sơ đồ ghế</h1> },
    ],
    { initialEntries: ["/", `/trips/${TRIP}/seats${query}`], initialIndex: 1 },
  );
  const page = (
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  render(strict ? <StrictMode>{page}</StrictMode> : page);
  return router;
}

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  useBookingDraftStore.getState().clearDraft();
});

it("opens a stopped trip directly without a prior draft or seat-selection visit", async () => {
  const start = vi
    .spyOn(httpBookingRepository, "createSession")
    .mockRejectedValue(new BookingRepositoryError("TRIP_NOT_SELLABLE", 422));
  renderTrip();
  expect(
    await screen.findByRole("heading", { name: "Chuyến đã ngừng bán" }),
  ).toBeVisible();
  expect(start).toHaveBeenCalledOnce();
  expect(useBookingDraftStore.getState().draft).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Sơ đồ ghế" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("link", { name: "Tìm chuyến khác" }));
  expect(
    await screen.findByRole("heading", { name: "Trang chủ" }),
  ).toBeVisible();
});

it("opens an active trip in a fresh browser draft, keeps passenger count, and replaces the entry URL", async () => {
  vi.spyOn(httpBookingRepository, "createSession").mockResolvedValue({
    sessionId: "new-session",
    tripId: TRIP,
    passengerCount: 2,
    selectedSeatIds: [],
    passengers: [],
    totalVnd: 0,
    expiresAt: new Date().toISOString(),
    status: "active",
  });
  const router = renderTrip("?passengerCount=2", true);
  expect(
    await screen.findByRole("heading", { name: "Sơ đồ ghế" }),
  ).toBeVisible();
  expect(useBookingDraftStore.getState().draft).toMatchObject({
    tripId: TRIP,
    passengerCount: 2,
    sessionId: "new-session",
  });
  await act(() => router.navigate(-1));
  expect(
    await screen.findByRole("heading", { name: "Trang chủ" }),
  ).toBeVisible();
});

it("does not label a missing trip as stopped", async () => {
  vi.spyOn(httpBookingRepository, "createSession").mockRejectedValue(
    new BookingRepositoryError("HTTP_ERROR", 404),
  );
  renderTrip();
  expect(
    await screen.findByRole("heading", { name: "Không tìm thấy chuyến" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Chuyến đã ngừng bán" }),
  ).not.toBeInTheDocument();
});

it("offers an explicit retry for a network error without retrying automatically", async () => {
  const start = vi
    .spyOn(httpBookingRepository, "createSession")
    .mockRejectedValueOnce(new BookingRepositoryError("NETWORK_ERROR"))
    .mockRejectedValueOnce(
      new BookingRepositoryError("TRIP_NOT_SELLABLE", 422),
    );
  renderTrip();
  expect(
    await screen.findByRole("heading", { name: "Không thể mở trang chọn ghế" }),
  ).toBeVisible();
  expect(start).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  expect(
    await screen.findByRole("heading", { name: "Chuyến đã ngừng bán" }),
  ).toBeVisible();
  await waitFor(() => expect(start).toHaveBeenCalledTimes(2));
});

it.each([
  "?passengerCount=0",
  "?passengerCount=7",
  "?passengerCount=1&passengerCount=2",
])(
  "does not start a booking with invalid passenger count: %s",
  async (query) => {
    const start = vi.spyOn(httpBookingRepository, "createSession");
    renderTrip(query);
    expect(
      screen.getByRole("heading", { name: "Số hành khách không hợp lệ" }),
    ).toBeVisible();
    expect(start).not.toHaveBeenCalled();
  },
);
