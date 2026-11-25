import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import type { z } from "zod";
import { server } from "@/mocks/server";
import type { livePaymentSchema } from "../schemas/livePayment.schema";
import { SePayReturnPage } from "./SePayReturnPage";

it("only reconciles when the customer clicks and shows when a late payment needs refunding", async () => {
  const bookingId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  let status = "PROCESSING";
  let checks = 0;
  const payment = (): z.input<typeof livePaymentSchema> => ({
    id: paymentId,
    bookingId,
    status,
    amount: 280000,
    currency: "VND",
    provider: "SEPAY",
  });
  server.use(
    http.get(`/api/v1/bookings/${bookingId}`, () =>
      HttpResponse.json({
        id: bookingId,
        code: "BKTEST",
        customerId: crypto.randomUUID(),
        tripId: crypto.randomUUID(),
        status: "PENDING_PAYMENT",
        paymentChannel: "PREPAID",
        total: 280000,
        currency: "VND",
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        rowVersion: 0,
        contact: {
          fullName: "Test",
          email: "customer@example.test",
          phone: "0900000000",
        },
        items: [],
      }),
    ),
    http.get(`/api/v1/bookings/${bookingId}/payments`, () =>
      HttpResponse.json([payment()]),
    ),
    http.post(`/api/v1/payments/${paymentId}/reconcile`, () => {
      checks++;
      status = "REFUND_PENDING";
      return HttpResponse.json(payment());
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const page = render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[`/payment/sepay/return?bookingId=${bookingId}`]}
      >
        <SePayReturnPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  try {
    const checkButton = await screen.findByRole("button", {
      name: "Kiểm tra giao dịch",
    });
    expect(checks).toBe(0);
    await userEvent.click(checkButton);
    expect(
      await screen.findByRole("heading", {
        name: "Đã ghi nhận thanh toán, đang xử lý hoàn tiền",
      }),
    ).toBeVisible();
    expect(checks).toBe(1);
  } finally {
    page.unmount();
    client.clear();
  }
});
