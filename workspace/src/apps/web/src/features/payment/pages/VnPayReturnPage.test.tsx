import type { RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it } from "vitest";

import { VnPayReturnPage } from "@/features/payment/pages/VnPayReturnPage";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type { PaymentStatus } from "@/features/payment/types/payment";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { paymentReturnPath } from "@/shared/config/routes";
import { createReadyPayment } from "@/test/payment";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
});
function show(path: string): RenderResult {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <VnPayReturnPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const cases: readonly { status: PaymentStatus; heading: string }[] = [
  { status: "success", heading: "Thanh toán thành công" },
  { status: "failed", heading: "Thanh toán chưa thành công" },
  { status: "cancelled", heading: "Đã hủy thanh toán" },
  { status: "pending", heading: "Thanh toán đang chờ xác nhận" },
];
it.each([
  ["pending", "ĐANG XỬ LÝ · TỰ ĐỘNG CẬP NHẬT", "Tiến trình thanh toán"],
  ["failed", "GIAO DỊCH CHƯA HOÀN TẤT", "Chọn cách xử lý"],
  ["cancelled", "GIAO DỊCH ĐÃ HỦY", "Chọn cách xử lý"],
  ["success", "ĐÃ XÁC NHẬN THANH TOÁN", "Vé đã phát hành"],
] as const)(
  "renders the exact %s state hierarchy",
  async (status, label, region) => {
    const { draft, transaction } = await createReadyPayment(status);
    useBookingDraftStore.getState().setDraft(draft);
    const { container } = show(
      paymentReturnPath(transaction.transactionId, transaction.resultId),
    );
    expect(await screen.findByText(label)).toBeVisible();
    expect(screen.getByText(region)).toBeVisible();
    expect(
      container.querySelector(".payment-result--" + status),
    ).not.toBeNull();
  },
);
it.each(cases)(
  "maps $status to trusted Vietnamese result without status query",
  async ({ status, heading }) => {
    const { draft, transaction } = await createReadyPayment(status);
    useBookingDraftStore.getState().setDraft(draft);
    show(paymentReturnPath(transaction.transactionId, transaction.resultId));
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "Hồ Chí Minh → Lâm Đồng" }),
    ).toBeVisible();
    expect(screen.getByText(transaction.bookingCode)).toBeVisible();
    if (status === "success") {
      expect(
        await screen.findAllByRole("link", { name: /Xem vé BLUE-/ }),
      ).toHaveLength(2);
      await waitFor(() =>
        expect(useBookingDraftStore.getState().draft).toBeNull(),
      );
    } else if (status !== "pending")
      expect(
        screen.getByRole("link", { name: "Chọn phương thức khác" }),
      ).toHaveAttribute("href", "/payment/" + draft.bookingId + "/vnpay");
    expect(
      screen.queryByText(/test\+review|0912345678/),
    ).not.toBeInTheDocument();
  },
);
it("pending recheck repeats only the same callback and never creates a new transaction", async () => {
  const { draft, transaction } = await createReadyPayment("pending");
  useBookingDraftStore.getState().setDraft(draft);
  let callbacks = 0,
    creates = 0;
  server.use(
    http.post("/api/v1/payments/vnpay/return", () => {
      callbacks++;
      return undefined;
    }),
    http.post("/api/v1/payments/vnpay", () => {
      creates++;
      return undefined;
    }),
  );
  show(paymentReturnPath(transaction.transactionId, transaction.resultId));
  await screen.findByRole("heading", { name: "Thanh toán đang chờ xác nhận" });
  expect(callbacks).toBe(1);
  await userEvent.click(
    screen.getByRole("button", { name: "Kiểm tra giao dịch" }),
  );
  await waitFor(() => expect(callbacks).toBe(2));
  expect(creates).toBe(0);
  expect(mockDb.tickets.size).toBe(0);
});
it.each([
  "",
  "?transactionId=one",
  "?transactionId=one&transactionId=two&resultId=opaque",
  "?transactionId=one&resultId=opaque&status=success",
])(
  "fails invalid callback query %s closed without a request",
  async (query) => {
    let count = 0;
    server.use(
      http.post("/api/v1/payments/vnpay/return", () => {
        count++;
        return HttpResponse.json({});
      }),
    );
    show("/payment/vnpay/return" + query);
    expect(
      await screen.findByRole("heading", {
        name: "Không thể xác nhận giao dịch",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(count).toBe(0);
  },
);
it("shows safe retry for callback network error without clearing draft", async () => {
  const { draft, transaction } = await createReadyPayment();
  useBookingDraftStore.getState().setDraft(draft);
  server.use(
    http.post("/api/v1/payments/vnpay/return", () =>
      HttpResponse.json({ detail: "PRIVATE" }, { status: 503 }),
    ),
  );
  show(paymentReturnPath(transaction.transactionId, transaction.resultId));
  await screen.findByRole("heading", { name: "Chưa thể kiểm tra giao dịch" });
  expect(screen.queryByText(/PRIVATE/)).not.toBeInTheDocument();
  expect(useBookingDraftStore.getState().draft?.bookingId).toBe(
    draft.bookingId,
  );
  server.resetHandlers();
  await userEvent.click(screen.getByRole("button", { name: "Kiểm tra lại" }));
  expect(
    await screen.findByRole("heading", { name: "Thanh toán thành công" }),
  ).toBeVisible();
});
