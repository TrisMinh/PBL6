import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { AdminPage } from "./pages/AdminPage";
import { BookingReviewPage } from "./pages/BookingReviewPage";
import { HomePage } from "./pages/HomePage";
import { PassengerDetailsPage } from "./pages/PassengerDetailsPage";
import { PaymentPage } from "./pages/PaymentPage";
import { SeatSelectionPage } from "./pages/SeatSelectionPage";
import { TicketPage } from "./pages/TicketPage";
import { TripResultsPage } from "./pages/TripResultsPage";

const BLOCKING_IMPACTS = new Set(["critical", "serious"]);

async function expectNoBlockingViolations(
  page: Page,
  testInfo: TestInfo,
  label: string,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter(({ impact }) =>
    impact ? BLOCKING_IMPACTS.has(impact) : false,
  );
  if (violations.length > 0) {
    await testInfo.attach(`axe-${label}`, {
      body: Buffer.from(JSON.stringify(violations, null, 2)),
      contentType: "application/json",
    });
  }
  expect(violations, `${label} has blocking axe violations`).toEqual([]);
}

async function scanReadyPage(
  page: Page,
  testInfo: TestInfo,
  label: string,
): Promise<void> {
  await page.waitForLoadState("networkidle");
  await expectNoBlockingViolations(page, testInfo, label);
}

test("authentication forms have no blocking axe violations and preserve keyboard controls", async ({
  page,
}, testInfo) => {
  for (const path of ["/login", "/register", "/forgot-password"]) {
    await page.goto(path);
    await scanReadyPage(page, testInfo, `auth-${path.slice(1)}`);
  }
  await page.goto("/login");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("BlueDemo2026");
  await page.getByRole("button", { name: "Hiện mật khẩu" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
});

test("customer booking routes have no serious or critical axe violations", async ({
  page,
}, testInfo) => {
  const home = new HomePage(page);
  await home.goto();
  await home.expectLoaded();
  await scanReadyPage(page, testInfo, "home");
  await home.searchForTwoPassengers();

  const trips = new TripResultsPage(page);
  await trips.expectCount(24);
  await scanReadyPage(page, testInfo, "trips-success");
  await trips.selectFirst();
  await trips.expectBookingStarted();

  const seats = new SeatSelectionPage(page);
  await scanReadyPage(page, testInfo, "seat-page");
  await seats.select("A01");
  await seats.select("A02");
  await seats.continue();

  const passengers = new PassengerDetailsPage(page);
  await scanReadyPage(page, testInfo, "passenger-form");
  await passengers.fill();
  await passengers.save();

  const review = new BookingReviewPage(page);
  await review.continue();
  const payment = new PaymentPage(page);
  await payment.pay();
  await payment.expectState("Thanh toán thành công");
  const bookingCode = await page
    .getByRole("article", { name: "Kết quả giao dịch" })
    .getByText(/^BLUE-[A-Z0-9-]+$/)
    .textContent();
  expect(bookingCode).toBeTruthy();

  const ticket = new TicketPage(page);
  await ticket.requireLookup();
  await ticket.lookup(bookingCode ?? "");
  await ticket.expectIssued();
  await scanReadyPage(page, testInfo, "ticket-detail");

  await page.getByRole("link", { name: "Hủy vé", exact: true }).click();
  await scanReadyPage(page, testInfo, "cancellation-selection");
  await page.getByRole("checkbox").first().check();
  const reviewCancellation = page.getByRole("button", {
    name: "Xem phí và tiền hoàn",
  });
  await reviewCancellation.click();
  const cancellationDialog = page.getByRole("dialog", {
    name: "Xác nhận hủy vé",
  });
  await expect(cancellationDialog).toBeVisible();
  await expect
    .poll(() =>
      cancellationDialog.evaluate((node) =>
        node.contains(document.activeElement),
      ),
    )
    .toBe(true);
  await scanReadyPage(page, testInfo, "cancellation-confirmation");
  await page.keyboard.press("Escape");
  await expect(cancellationDialog).toHaveCount(0);
  await expect(reviewCancellation).toBeFocused();
  await reviewCancellation.click();
  await page
    .getByRole("dialog", { name: "Xác nhận hủy vé" })
    .getByRole("button", { name: "Xác nhận hủy 1 vé" })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Theo dõi hoàn tiền" }),
  ).toBeVisible();
  await scanReadyPage(page, testInfo, "cancellation-processing");
});

test("admin organization list and detail have no blocking axe violations", async ({
  page,
}, testInfo) => {
  const admin = new AdminPage(page);
  await admin.login();
  await admin.expectResponsiveTable("Danh sách tổ chức");
  await scanReadyPage(page, testInfo, "admin-organizations");
  await page.getByRole("link", { name: "BLUE Demo Transit" }).click();
  await expect(
    page.getByRole("heading", { name: "BLUE Demo Transit" }),
  ).toBeVisible();
  await scanReadyPage(page, testInfo, "admin-organization-detail");
});

async function expectCustomerNavigationKeyboard(page: Page): Promise<void> {
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Đến nội dung chính" });
  await expect(skipLink).toBeFocused();
  const focusOutline = await skipLink.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      style: styles.outlineStyle,
      width: Number.parseFloat(styles.outlineWidth),
    };
  });
  expect(focusOutline.style).toBe("solid");
  expect(focusOutline.width).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const trigger = page.getByRole("button", { name: "Mở menu" });
  if (!(await trigger.isVisible())) return;
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Menu BLUE" });
  await expect(drawer).toBeVisible();
  await expect
    .poll(() =>
      drawer.evaluate((node) => node.contains(document.activeElement)),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
}

async function expectBookingKeyboard(page: Page): Promise<void> {
  const seats = new SeatSelectionPage(page);
  await seats.start();
  const firstSeat = seats.seat("A01");
  await firstSeat.focus();
  await page.keyboard.press("Space");
  await expect(firstSeat).toHaveAttribute("aria-pressed", "true");
  await seats.select("A02");
  await seats.continue();

  const passengers = new PassengerDetailsPage(page);
  await passengers.confirm.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "Thông tin chưa hợp lệ" }),
  ).toBeVisible();
  await expect(page.getByLabel("Họ và tên (ghế A01)")).toBeFocused();
  await expect(page.getByLabel("Họ và tên (ghế A01)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
}

test("customer keyboard path exposes skip, drawer, seat and form feedback", async ({
  page,
}) => {
  const home = new HomePage(page);
  await home.goto();
  await home.expectLoaded();
  await expectCustomerNavigationKeyboard(page);
  await expectBookingKeyboard(page);
});

test("admin drawers and organization dialog return keyboard focus", async ({
  page,
}) => {
  const admin = new AdminPage(page);
  await admin.login();
  const drawerTrigger = page.getByRole("button", {
    name: "Mở menu quản trị",
  });
  if (await drawerTrigger.isVisible()) {
    await drawerTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Menu quản trị" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawerTrigger).toBeFocused();
  }

  const createTrigger = page.getByRole("button", { name: "+ Thêm tổ chức" });
  await createTrigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Thêm tổ chức" });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog.evaluate((node) => node.contains(document.activeElement)),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(createTrigger).toBeFocused();
});
