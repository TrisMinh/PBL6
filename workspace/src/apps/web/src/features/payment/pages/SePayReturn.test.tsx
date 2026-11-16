import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it } from "vitest";
import { BackendPaymentReturnPage } from "./BackendPaymentPage";
import { liveQueryKey } from "@/shared/api/liveRequest";

const id = "019aff01-0000-7000-8000-000000006002";
const ticket = "019aff01-0000-7000-8000-000000006003";
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
});
function show(status: string, issued = false): void {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  clients.push(client);
  client.setQueryData(liveQueryKey("payment-result-booking", id), {
    id,
    tripId: id,
    code: "BKREAL",
    expiresAt: "2026-11-17T00:00:00Z",
    items: [],
  });
  client.setQueryData(liveQueryKey("payment-return", id), [
    { id, bookingId: id, status, amount: 300000, currency: "VND" },
  ]);
  client.setQueryData(
    liveQueryKey("booking-tickets", id),
    issued
      ? [
          {
            id: ticket,
            seatCode: "A01",
            passengerName: "Nguyễn An",
            publicCode: "TK-REAL",
          },
        ]
      : [],
  );
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          `/payment/sepay/return?bookingId=${id}&status=success`,
        ]}
      >
        <BackendPaymentReturnPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("does not report success from a success query parameter while backend is processing", () => {
  show("PROCESSING");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Đang chờ xác nhận thanh toán",
  );
  expect(screen.queryByRole("link", { name: /Xem vé/ })).toBeNull();
});
it("waits for actual issued tickets after backend captures payment", () => {
  show("SUCCEEDED");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Đã nhận thanh toán",
  );
  expect(screen.queryByText("Thanh toán thành công")).toBeNull();
});
it("links to the real ticket only after backend returns it", () => {
  show("SUCCEEDED", true);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Thanh toán thành công",
  );
  expect(screen.getByRole("link", { name: /Xem vé/ })).toHaveAttribute(
    "href",
    `/tickets/${ticket}`,
  );
});
it("shows pending refund honestly without claiming tickets were issued", () => {
  show("REFUND_PENDING");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Thanh toán cần xử lý hoàn tiền",
  );
  expect(screen.queryByRole("link", { name: /Xem vé/ })).toBeNull();
});
