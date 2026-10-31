import { expect, test } from "@playwright/test";

import { PaymentPage } from "./pages/PaymentPage";

test("guest payment succeeds once and refresh replays the exact issued tickets after clearing draft", async ({
  page,
}) => {
  const payment = new PaymentPage(page);
  let creates = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/v1/payments/vnpay")
    )
      creates++;
  });
  await payment.start();
  const before = JSON.parse((await payment.draft()) ?? "null").state.draft;
  await payment.pay();
  await payment.expectState("Thanh toán thành công");
  await expect.poll(() => payment.draft()).toBeNull();
  const codes = await payment.ticketCodes();
  expect(codes).toHaveLength(2);
  expect(creates).toBe(1);
  const params = new URL(page.url()).searchParams;
  expect([...params.keys()].sort()).toEqual(["resultId", "transactionId"]);
  expect(page.url()).not.toMatch(/status=|email|phone|bookingCode|amountVnd/);
  await page.reload();
  await payment.expectState("Thanh toán thành công");
  expect(await payment.ticketCodes()).toEqual(codes);
  expect(await payment.draft()).toBeNull();
  expect(creates).toBe(1);
  expect(before.expiresAt).toBeTruthy();
});
test("@critical failed payment preserves the booking and retries with a new payment attempt", async ({
  page,
}) => {
  const payment = new PaymentPage(page);
  const keys: (string | undefined)[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/v1/payments/vnpay")
    )
      keys.push(request.headers()["idempotency-key"]);
  });
  await payment.start();
  const before = JSON.parse((await payment.draft()) ?? "null").state.draft;
  await payment.pay("Mô phỏng thất bại");
  await payment.expectState("Thanh toán chưa thành công");
  await payment.expectNoTickets();
  const failed = JSON.parse((await payment.draft()) ?? "null").state.draft;
  expect(failed.bookingId).toBe(before.bookingId);
  expect(failed.expiresAt).toBe(before.expiresAt);
  expect(failed.paymentAttempt).toBeUndefined();
  await payment.retry();
  await payment.pay();
  await payment.expectState("Thanh toán thành công");
  expect(keys).toHaveLength(2);
  expect(keys[0]).not.toBe(keys[1]);
  expect(await payment.ticketCodes()).toHaveLength(2);
});
for (const scenario of [
  { label: "Mô phỏng hủy", heading: "Đã hủy thanh toán", pending: false },
  {
    label: "Mô phỏng chờ xác nhận",
    heading: "Thanh toán đang chờ xác nhận",
    pending: true,
  },
])
  test(
    scenario.heading + " keeps original recovery without tickets",
    async ({ page }) => {
      const payment = new PaymentPage(page);
      let creates = 0;
      page.on("request", (r) => {
        if (r.method() === "POST" && r.url().endsWith("/api/v1/payments/vnpay"))
          creates++;
      });
      await payment.start();
      const before = JSON.parse((await payment.draft()) ?? "null").state.draft;
      await payment.pay(scenario.label);
      await payment.expectState(scenario.heading);
      await payment.expectNoTickets();
      if (scenario.pending) {
        await payment.recheck();
        await payment.expectState(scenario.heading);
      }
      const after = JSON.parse((await payment.draft()) ?? "null").state.draft;
      expect(after.expiresAt).toBe(before.expiresAt);
      expect(after.bookingId).toBe(before.bookingId);
      expect(creates).toBe(1);
    },
  );
test("unknown callback IDs expose safe public recovery", async ({ page }) => {
  await new PaymentPage(page).invalid();
});
