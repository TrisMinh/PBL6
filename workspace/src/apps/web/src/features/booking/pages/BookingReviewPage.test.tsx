import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it } from "vitest";

import { BookingReviewPage } from "@/features/booking/pages/BookingReviewPage";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { mockDb } from "@/mocks/state/mockDb";
import { createReadyBookingSession } from "@/test/booking";
import { BookingSessionRoute } from "@/app/guards/BookingSessionRoute";

afterEach(() => {
  cleanup();
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
});
it("offers a new search rather than a locked edit loop for malformed booked draft", async () => {
  const draft = await createReadyBookingSession();
  useBookingDraftStore
    .getState()
    .setDraft({ ...draft, bookingId: "existing-booking", contact: undefined });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BookingReviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", {
    name: "Vui lòng kiểm tra thông tin đặt vé",
  });
  expect(screen.getByRole("link", { name: "Tìm lại chuyến" })).toHaveAttribute(
    "href",
    "/",
  );
  expect(
    screen.queryByRole("link", { name: "Chỉnh sửa hành khách" }),
  ).not.toBeInTheDocument();
  cleanup();
  client.clear();
});
it.each(["contact", "passenger", "selection", "total"])(
  "fails closed for malformed %s draft without offering payment",
  async (mode) => {
    const draft = await createReadyBookingSession();
    if (mode === "contact") draft.contact = undefined;
    if (mode === "passenger") draft.passengers[0].seatId = "foreign";
    if (mode === "selection") draft.selectedSeatIds = [];
    if (mode === "total") draft.totalVnd++;
    useBookingDraftStore.getState().setDraft(draft);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BookingReviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("heading", {
        name: "Vui lòng kiểm tra thông tin đặt vé",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Tiếp tục thanh toán/ }),
    ).not.toBeInTheDocument();
    expect(mockDb.bookings.size).toBe(0);
    cleanup();
    client.clear();
  },
);
it("creates once through guarded review and preserves booking on back and refresh", async () => {
  const draft = await createReadyBookingSession();
  useBookingDraftStore.getState().setDraft(draft);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const router = createMemoryRouter(
    [
      {
        element: <BookingSessionRoute />,
        children: [
          {
            path: "/booking/:sessionId/review",
            element: <BookingReviewPage />,
          },
          {
            path: "/payment/:bookingId/vnpay",
            element: <h1>Chuẩn bị VNPay</h1>,
          },
        ],
      },
      { path: "/trips", element: <h1>Hết hạn</h1> },
    ],
    { initialEntries: [`/booking/${draft.sessionId}/review`] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const button = await screen.findByRole("button", {
    name: /Tiếp tục thanh toán/,
  });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.dblClick(button);
  await screen.findByRole("heading", { name: "Chuẩn bị VNPay" });
  const saved = useBookingDraftStore.getState().draft;
  expect(saved?.bookingId).toBeTruthy();
  expect(saved?.expiresAt).toBe(draft.expiresAt);
  expect(mockDb.bookings.size).toBe(1);
  await act(() => router.navigate(-1));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đặt vé đã được xác nhận",
    ),
  );
  expect(
    screen.queryByRole("link", { name: /Chỉnh sửa/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: /Tiếp tục thanh toán/ }),
  );
  await screen.findByRole("heading", { name: "Chuẩn bị VNPay" });
  expect(mockDb.bookings.size).toBe(1);
  expect(useBookingDraftStore.getState().draft?.bookingId).toBe(
    saved?.bookingId,
  );
  cleanup();
  client.clear();
});
it("shows review only for complete passengers and canonical held selection", async () => {
  const draft = await createReadyBookingSession();
  useBookingDraftStore.getState().setDraft(draft);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BookingReviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("region", { name: "Hành trình & nhà xe" }),
  ).toBeVisible();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Kiểm tra trước khi thanh toán",
  );
  expect(
    screen.getByRole("button", { name: /Tiếp tục thanh toán/ }),
  ).toBeVisible();
  cleanup();
  client.clear();
});
