import { expect, test, type Page } from "@playwright/test";

import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";
import { AdminPage } from "./pages/AdminPage";
import { BookingReviewPage } from "./pages/BookingReviewPage";
import { HomePage } from "./pages/HomePage";
import { PassengerDetailsPage } from "./pages/PassengerDetailsPage";
import { PaymentPage } from "./pages/PaymentPage";
import { SeatSelectionPage } from "./pages/SeatSelectionPage";
import { TicketPage } from "./pages/TicketPage";
import { TripResultsPage } from "./pages/TripResultsPage";

test.use({ colorScheme: "light", reducedMotion: "reduce" });

async function assertReadyAndFits(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await assertNoPageOverflow(page);
}

test("all authentication frames fit every supported viewport", async ({
  page,
}) => {
  for (const path of ["/login", "/register", "/forgot-password"]) {
    await page.goto(path);
    await assertReadyAndFits(page);
    await expect(page.locator(".auth-page__shell")).toBeVisible();
  }
});

test("overflow helper reports the visible offending element", async ({
  page,
}) => {
  await page.setContent(
    '<main><div class="overflow-probe" style="width: calc(100vw + 40px)">probe</div></main>',
  );

  await expect(assertNoPageOverflow(page)).rejects.toThrow(/overflow-probe/);
});

test("explicit internal scrollers do not create document overflow", async ({
  page,
}) => {
  await page.setContent(`
    <style>body { margin: 0 } .seat-map__scroller, .admin-table__scroller { overflow-x: auto; width: 100% } .wide-content { width: 200vw }</style>
    <div class="seat-map__scroller"><div class="wide-content">seat map</div></div>
    <div class="admin-table__scroller"><div class="wide-content">table</div></div>
  `);

  await assertNoPageOverflow(page);
});

test("core customer journey has no document overflow", async ({ page }) => {
  const home = new HomePage(page);
  await home.goto();
  await home.expectLoaded();
  await assertReadyAndFits(page);
  await home.searchForTwoPassengers();

  const results = new TripResultsPage(page);
  await results.expectCount(24);
  await assertReadyAndFits(page);
  await results.selectFirst();
  await results.expectBookingStarted();

  const seats = new SeatSelectionPage(page);
  await assertReadyAndFits(page);
  await seats.select("A01");
  await seats.select("A02");
  await seats.continue();

  const passengers = new PassengerDetailsPage(page);
  await assertReadyAndFits(page);
  await passengers.fill();
  await passengers.save();

  const review = new BookingReviewPage(page);
  await assertReadyAndFits(page);
  await review.continue();

  const payment = new PaymentPage(page);
  await assertReadyAndFits(page);
  await payment.pay();
  await payment.expectState("Thanh toán thành công");
  await assertReadyAndFits(page);

  const bookingCode = await page
    .getByRole("article", { name: "Kết quả giao dịch" })
    .getByText(/^BLUE-[A-Z0-9-]+$/)
    .textContent();
  expect(bookingCode).toBeTruthy();
  const ticket = new TicketPage(page);
  await ticket.requireLookup();
  await assertReadyAndFits(page);
  await ticket.lookup(bookingCode ?? "");
  await ticket.expectIssued();
  await assertReadyAndFits(page);

  await page.getByRole("link", { name: "Hủy vé", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn vé cần hủy" }),
  ).toBeVisible();
  await assertReadyAndFits(page);
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: "Xem phí và tiền hoàn" }).click();
  await expect(
    page.getByRole("dialog", { name: "Xác nhận hủy vé" }),
  ).toBeVisible();
  await assertReadyAndFits(page);
  await page
    .getByRole("dialog", { name: "Xác nhận hủy vé" })
    .getByRole("button", { name: "Xác nhận hủy 1 vé" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Theo dõi hoàn tiền" }),
  ).toBeVisible();
  await assertReadyAndFits(page);
});

const ADMIN_LISTS = [
  ["/admin/organizations", "Danh sách tổ chức"],
  ["/admin/staff", "Danh sách nhân viên"],
  ["/admin/bookings", "Danh sách đơn đặt vé"],
  ["/admin/payments", "Danh sách giao dịch thanh toán"],
  ["/admin/refunds", "Danh sách khoản hoàn"],
] as const;

test("canonical admin lists have no document overflow", async ({ page }) => {
  const admin = new AdminPage(page);
  await admin.login();
  for (const [path, caption] of ADMIN_LISTS) {
    await page.goto(path);
    await admin.expectResponsiveTable(caption);
    await assertReadyAndFits(page);
  }
});
