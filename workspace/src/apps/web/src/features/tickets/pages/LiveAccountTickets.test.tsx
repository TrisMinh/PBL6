import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
vi.mock("@/shared/api/config", () => ({ isMockApi: false, apiBaseUrl: "" }));
vi.mock("@/features/auth/hooks/useAccountSession", () => ({
  useAccountSession: () => ({
    session: { userId: "test-user" },
    isHydrated: true,
  }),
}));
const id = "01990a00-0000-7000-8000-000000000001";
vi.mock("@/shared/api/client", () => ({
  apiJson: async (path: string) => {
    if (path.startsWith("/api/v1/tickets?"))
      return {
        items: [
          {
            id,
            publicCode: "TKLIVE",
            bookingId: id,
            tripId: id,
            passengerName: "Demo Passenger",
            seatCode: "A01",
            status: "ISSUED",
          },
        ],
        totalElements: 1,
        totalPages: 1,
      };
    if (path.startsWith("/api/v1/bookings/")) return { code: "BKLIVE" };
    return {
      id,
      organizationId: id,
      operatorName: "BLUE Demo",
      busType: "SLEEPER_34",
      amenities: [],
      departureAt: "2026-11-17T08:00:00+07:00",
      arrivalAt: "2026-11-17T14:00:00+07:00",
      origin: "TP. Hồ Chí Minh",
      destination: "Đà Lạt",
      fare: { amount: 280000, currency: "VND" },
      stops: [],
      status: "SCHEDULED",
      sellable: true,
    };
  },
}));
import { LiveAccountTickets } from "./LiveAccountTickets";
it("uses the shared ticket design, formats backend offset dates and switches density without losing backend links", async () => {
  sessionStorage.clear();
  const rendered = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <LiveAccountTickets />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Demo Passenger")).toBeVisible();
  expect(screen.getByText("08:00")).toBeVisible();
  expect(screen.getByText("17/11/2026")).toBeVisible();
  expect(screen.getByRole("link", { name: "Xem vé TKLIVE" })).toHaveAttribute(
    "href",
    `/tickets/${id}`,
  );
  expect(screen.getByRole("link", { name: "Hủy vé" })).toHaveAttribute(
    "href",
    `/bookings/${id}/cancel`,
  );
  expect(
    rendered.container.querySelector(".account-tickets__photo"),
  ).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Lưới nhỏ" }));
  expect(
    rendered.container.querySelector(".account-tickets__photo"),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Danh sách" }));
  expect(
    rendered.container.querySelector(".account-tickets__photo"),
  ).not.toBeNull();
  expect(screen.getByRole("button", { name: "Danh sách" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
