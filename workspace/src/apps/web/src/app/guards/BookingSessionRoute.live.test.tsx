import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { BookingSessionRoute } from "./BookingSessionRoute";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";

vi.mock("@/shared/api/config", () => ({ isMockApi: false }));
vi.mock("@/features/booking/hooks/useBookingDraftHydration", () => ({
  useBookingDraftHydration: () => true,
}));
vi.mock("@/shared/lib/useSessionClock", () => ({
  useSessionClock: () => Date.now(),
}));
afterEach(() => useBookingDraftStore.getState().clearDraft());

it("keeps live review mounted when the new bookingId arrives before payment navigation", async () => {
  useBookingDraftStore.getState().setDraft({
    sessionId: "live-session",
    tripId: "live-trip",
    bookingId: "new-booking",
    passengerCount: 1,
    selectedSeatIds: [],
    passengers: [],
    totalVnd: 180000,
    expiresAt: "2000-01-01T00:00:00Z",
  });
  const router = createMemoryRouter(
    [
      {
        element: <BookingSessionRoute />,
        children: [
          { path: "/booking/:sessionId/review", element: <h1>Review</h1> },
          { path: "/payment/:bookingId/vnpay", element: <h1>Payment</h1> },
        ],
      },
      { path: "/trips", element: <h1>Expired</h1> },
    ],
    { initialEntries: ["/booking/live-session/review"] },
  );
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole("heading", { name: "Review" })).toBeVisible();
  await router.navigate("/payment/new-booking/vnpay");
  expect(await screen.findByRole("heading", { name: "Payment" })).toBeVisible();
  expect(router.state.location.pathname).toBe("/payment/new-booking/vnpay");
});
