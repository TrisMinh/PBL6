import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { ReactElement } from "react";
vi.mock("@/shared/api/config", () => ({ isMockApi: false, apiBaseUrl: "" }));
const auth = vi.hoisted(() => ({ signedIn: false }));
vi.mock("@/features/auth/hooks/useAccountSession", () => ({
  useAccountSession: () => ({
    isHydrated: true,
    session: auth.signedIn
      ? { userId: "test", token: "test", role: "customer" }
      : null,
  }),
}));
import { BackendTicketLookupPage } from "./BackendTicketLookupPage";
const id = "01990a00-0000-7000-8000-000000000001";
beforeEach(() => {
  auth.signedIn = false;
  sessionStorage.clear();
});
function mount(): ReactElement {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <BackendTicketLookupPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
it("keeps the photographic lookup shell and clear sign-in action without fetching private data", () => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  render(mount());
  expect(
    screen.getByAltText("Xe khách trên cung đường núi xanh"),
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "Tra cứu vé" })).toBeVisible();
  expect(
    screen.getByRole("link", { name: /Đăng nhập để tra cứu/ }),
  ).toHaveAttribute("href", "/login");
  expect(screen.getByRole("link", { name: /Vé của tôi/ })).toBeVisible();
  expect(fetcher).not.toHaveBeenCalled();
});
it("looks up only authorized tickets and links to the backend ticket ID", async () => {
  auth.signedIn = true;
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      page: 0,
      size: 100,
      totalElements: 1,
      totalPages: 1,
      items: [
        {
          id,
          publicCode: "TKDEMO123",
          bookingId: id,
          tripId: id,
          passengerName: "Demo Passenger",
          seatCode: "A01",
          status: "ISSUED",
          paymentChannel: "PREPAID",
          issuedAt: "2026-11-16T00:00:00Z",
          rowVersion: 0,
        },
      ],
    }),
  );
  render(mount());
  fireEvent.change(screen.getByLabelText("Mã vé hoặc mã đặt vé"), {
    target: { value: "tkdemo123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tra cứu vé" }));
  const link = await screen.findByRole("link", { name: "Xem vé" });
  expect(link).toHaveAttribute("href", `/tickets/${id}`);
  expect(screen.getByText("Demo Passenger")).toBeVisible();
  expect(fetcher.mock.calls[0][0]).toContain("/api/v1/tickets?");
});
it("shows a toast when no authorized ticket or booking matches", async () => {
  auth.signedIn = true;
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    Response.json({
      page: 0,
      size: 100,
      totalElements: 0,
      totalPages: 0,
      items: [],
    }),
  );
  render(mount());
  fireEvent.change(screen.getByLabelText("Mã vé hoặc mã đặt vé"), {
    target: { value: "UNKNOWN" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tra cứu vé" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Không tìm thấy vé hoặc đơn phù hợp",
  );
});
