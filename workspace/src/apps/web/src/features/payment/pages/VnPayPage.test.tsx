import type { ReactElement } from "react";
import type { RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, expect, it, vi } from "vitest";

import { createReadyPayment } from "@/test/payment";
import { httpPaymentRepository } from "@/features/payment/repositories/httpPaymentRepository";
import type { BookingSession } from "@/features/booking/types/booking";
import { VnPayPage } from "@/features/payment/pages/VnPayPage";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { createReadyBookingSession } from "@/test/booking";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
  vi.unstubAllEnvs();
});
function Path(): ReactElement {
  const l = useLocation();
  return <output aria-label="Current path">{l.pathname + l.search}</output>;
}
async function setup(): Promise<BookingSession> {
  const session = await createReadyBookingSession(),
    booking = await httpBookingRepository.createBooking(
      session.sessionId,
      "booking-key",
    );
  useBookingDraftStore
    .getState()
    .setDraft({ ...session, bookingId: booking.bookingId });
  return session;
}
function show(): RenderResult {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VnPayPage />
        <Path />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("shows payment options and waiting state without a redundant continue action", async () => {
  await setup();
  show();
  await screen.findByRole("region", { name: "VNPay mô phỏng" });
  expect(screen.getByRole("tab", { name: "VNPay QR" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    screen.getByRole("tab", { name: "Thẻ ATM / Ngân hàng" }),
  ).toBeVisible();
  expect(screen.getByText("Chờ xác nhận thanh toán")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Tiếp tục đến VNPay" }),
  ).not.toBeInTheDocument();
});
it("keeps transaction details available separately from payment choices", async () => {
  await setup();
  show();
  await screen.findByRole("region", { name: "VNPay mô phỏng" });
  await userEvent.click(
    screen.getByText("Thông tin giao dịch", { selector: "summary" }),
  );
  expect(screen.getByText("MÃ ĐẶT CHỖ")).toBeVisible();
  expect(screen.getByText("MÃ THAM CHIẾU THANH TOÁN")).toBeVisible();
  expect(screen.getByText("Đơn hàng của bạn")).toBeVisible();
});
it("switches away from QR to a bank without creating a transaction", async () => {
  await setup();
  show();
  await screen.findByRole("region", { name: "VNPay mô phỏng" });
  await userEvent.click(
    screen.getByRole("tab", { name: "Thẻ ATM / Ngân hàng" }),
  );
  await userEvent.click(screen.getByRole("radio", { name: /Vietcombank/ }));
  expect(screen.getByRole("radio", { name: /Vietcombank/ })).toBeChecked();
  expect(useBookingDraftStore.getState().draft?.paymentAttempt).toBeUndefined();
});
it("rapid payment click creates one transaction and stores IDs before callback route", async () => {
  const initial = await setup();
  let calls = 0;
  server.use(
    http.post("/api/v1/payments/vnpay", () => {
      calls++;
      return undefined;
    }),
  );
  show();
  await screen.findByRole("region", { name: "VNPay mô phỏng" });
  await userEvent.click(
    screen.getByText("Bản trải nghiệm · Mô phỏng kết quả ngân hàng"),
  );
  await userEvent.dblClick(
    screen.getByRole("button", { name: "Xác nhận thanh toán mô phỏng" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Current path")).toHaveTextContent(
      "/payment/vnpay/return?transactionId=",
    ),
  );
  expect(calls).toBe(1);
  expect(useBookingDraftStore.getState().draft).toMatchObject({
    expiresAt: initial.expiresAt,
    paymentAttempt: {
      transactionId: expect.any(String),
      resultId: expect.any(String),
    },
  });
  expect(mockDb.tickets.size).toBe(0);
});
it("safe retry keeps original key/booking while failure detail never renders", async () => {
  const initial = await setup();
  const keys: (string | null)[] = [];
  let first = true;
  server.use(
    http.post("/api/v1/payments/vnpay", ({ request }) => {
      keys.push(request.headers.get("Idempotency-Key"));
      if (first) {
        first = false;
        return HttpResponse.json({ detail: "PRIVATE" }, { status: 503 });
      }
      return undefined;
    }),
  );
  show();
  await screen.findByRole("region", { name: "VNPay mô phỏng" });
  await userEvent.click(
    screen.getByText("Bản trải nghiệm · Mô phỏng kết quả ngân hàng"),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Xác nhận thanh toán mô phỏng" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Chưa thể tạo giao dịch",
  );
  expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Thử lại yêu cầu thanh toán" }),
  );
  await waitFor(() => expect(keys).toHaveLength(2));
  expect(keys[0]).toBe(keys[1]);
  expect(useBookingDraftStore.getState().draft?.expiresAt).toBe(
    initial.expiresAt,
  );
});
it("fails malformed booked draft closed without offering payment", async () => {
  await setup();
  useBookingDraftStore
    .getState()
    .setContact({ fullName: "", email: "", phone: "" });
  show();
  expect(
    await screen.findByRole("heading", { name: "Vui lòng kiểm tra đặt vé" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Tiếp tục đến VNPay" }),
  ).not.toBeInTheDocument();
});

it("recovers the existing receipt after server success whose callback response was lost", async () => {
  const { draft, transaction } = await createReadyPayment();
  useBookingDraftStore.getState().setDraft(draft);
  await httpPaymentRepository.resolve(
    transaction.transactionId,
    transaction.resultId,
  );
  let creates = 0;
  server.use(
    http.post("/api/v1/payments/vnpay", () => {
      creates++;
      return undefined;
    }),
  );
  show();
  const link = await screen.findByRole("link", { name: "Kiểm tra giao dịch" });
  await userEvent.click(link);
  expect(screen.getByLabelText("Current path")).toHaveTextContent(
    transaction.returnPath,
  );
  expect(creates).toBe(0);
  expect(mockDb.tickets.size).toBe(2);
  expect(
    useBookingDraftStore.getState().draft?.paymentAttempt?.transactionId,
  ).toBe(transaction.transactionId);
});
