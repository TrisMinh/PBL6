import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { BackendPaymentPage } from "./BackendPaymentPage";

const bookingId = "019aff01-0000-7000-8000-000000006002";
const expiresAt = "2026-11-03T03:10:00.000Z";
const clients: QueryClient[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T03:00:00.000Z"));
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
});

function showPayment(status = "PENDING_PAYMENT"): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  clients.push(client);
  client.setQueryData(["live-api", "booking", bookingId], {
    id: bookingId,
    code: "BLUE-TEST",
    status,
    expiresAt,
    total: 160000,
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/payment/${bookingId}/vnpay`]}>
        <Routes>
          <Route
            path="/payment/:bookingId/vnpay"
            element={<BackendPaymentPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it("counts down from the backend deadline and preserves it when reopening the page", async () => {
  const page = showPayment();
  expect(screen.getByRole("timer")).toHaveTextContent("10:00");
  await act(() => vi.advanceTimersByTimeAsync(125000));
  expect(screen.getByRole("timer")).toHaveTextContent("07:55");
  page.unmount();
  showPayment();
  expect(screen.getByRole("timer")).toHaveTextContent("07:55");
});

it("stops at zero, explains expiry and disables payment at the backend deadline", async () => {
  showPayment();
  expect(
    screen.getByRole("button", { name: "Thanh toán qua VNPay" }),
  ).toBeEnabled();
  await act(() => vi.advanceTimersByTimeAsync(600000));
  expect(
    screen.queryByRole("button", { name: "Thanh toán qua VNPay" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Đã hết thời gian giữ ghế",
  );
  expect(screen.getByRole("link", { name: "Tìm chuyến khác" })).toHaveAttribute(
    "href",
    "/",
  );
  expect(
    screen.queryByRole("link", { name: "Xem đơn của tôi" }),
  ).not.toBeInTheDocument();
});

it("shows recovery when the backend already returns EXPIRED on reload", () => {
  showPayment("EXPIRED");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Đã hết thời gian giữ ghế",
  );
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Thanh toán qua VNPay" }),
  ).not.toBeInTheDocument();
});

it("does not show an active hold countdown for a completed booking", () => {
  showPayment("CONFIRMED");
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Thanh toán qua VNPay" }),
  ).toBeDisabled();
});
