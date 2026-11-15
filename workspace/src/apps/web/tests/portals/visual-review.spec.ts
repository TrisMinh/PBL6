import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { SeatSelectionPage } from "../e2e/pages/SeatSelectionPage";
import { PassengerDetailsPage } from "../e2e/pages/PassengerDetailsPage";
import { BookingReviewPage } from "../e2e/pages/BookingReviewPage";
import { PaymentPage } from "../e2e/pages/PaymentPage";

const evidence = resolve(
  process.cwd(),
  "../../../../docs/implementation/desktop-visual-polish/reviewed",
);

test("trip editor retains the Figma desktop shell and route pickers", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop visual review.");
  await page.goto("http://127.0.0.1:5274/login");
  await page.getByRole("button", { name: "Điền tài khoản demo" }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/operator\/trips$/);
  await page
    .getByRole("button", { name: "Tạo chuyến mới", exact: true })
    .click();
  await expect(page).toHaveURL(/operator\/trips\/new$/);
  await expect(page.getByLabel("Điểm đi", { exact: true })).toBeVisible();
  expect(
    await page.locator(".operator-trip-workflow__header").boundingBox(),
  ).toEqual({ x: 214, y: 16, width: 1210, height: 68 });
  expect(await page.locator(".operator-create__steps").boundingBox()).toEqual({
    x: 214,
    y: 92,
    width: 1210,
    height: 72,
  });
  await page
    .getByLabel("Điểm đi", { exact: true })
    .selectOption({ label: "TP.HCM" });
  await expect(page.getByLabel("Điểm đến", { exact: true })).toHaveValue(
    "RT-HCM-DLI",
  );
  await page
    .getByRole("button", { name: "Đổi điểm đi và điểm đến", exact: true })
    .click();
  await expect(page.getByLabel("Điểm đi", { exact: true })).toHaveValue(
    "Đà Lạt",
  );
  await expect(page.getByLabel("Điểm đến", { exact: true })).toHaveValue(
    "RT-DLI-HCM",
  );
  await capture(page, "operator-new-trip-selected");
});
async function capture(page: Page, name: string): Promise<void> {
  await mkdir(evidence, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: resolve(evidence, `${name}.png`),
    fullPage: true,
  });
  await page.screenshot({ path: resolve(evidence, `${name}-viewport.png`) });
}

test.beforeEach(({ browserName }, info) => {
  void browserName;
  test.skip(info.project.name !== "desktop", "Desktop visual review.");
});

test("capture customer booking states for visual review", async ({ page }) => {
  const seats = new SeatSelectionPage(page);
  await seats.start();
  await capture(page, "customer-seats");
  await seats.select("A01");
  await seats.select("A02");
  await seats.continue();
  const passengers = new PassengerDetailsPage(page);
  await capture(page, "customer-passengers");
  await passengers.fill();
  await passengers.save();
  await capture(page, "customer-review");
  await new BookingReviewPage(page).continue();
  await capture(page, "customer-payment");
  await capture(page, "customer-gateway-qr");
  await page.getByRole("tab", { name: "Thẻ ATM / Ngân hàng" }).click();
  await capture(page, "customer-gateway-bank");
  const payment = new PaymentPage(page);
  await payment.pay();
  await payment.expectState("Thanh toán thành công");
  await capture(page, "customer-payment-success");
  const bookingCode = await page
    .getByRole("article", { name: "Kết quả giao dịch" })
    .locator(".payment-result__booking-code b")
    .textContent();
  await page
    .getByRole("link", { name: /Xem vé BLUE-/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/tickets\/BLUE-/);
  await expect(
    page.getByRole("heading", { name: "Cần xác thực để xem vé", exact: true }),
  ).toBeVisible();
  await capture(page, "customer-ticket-verification");
  await page
    .getByRole("main")
    .getByRole("link", { name: "Tra cứu vé", exact: true })
    .click();
  await page.getByLabel("Mã đặt vé", { exact: true }).fill(bookingCode ?? "");
  await page
    .getByLabel("Email hoặc số điện thoại đã đặt vé", { exact: true })
    .fill("test+review@example.invalid");
  await page.getByRole("button", { name: "Tra cứu vé", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Vé điện tử", exact: true }),
  ).toBeVisible();
  await capture(page, "customer-ticket-detail");
});

test("account actions have spacing and Figma hover color after route changes", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:5275/login");
  await page.getByRole("button", { name: "Điền tài khoản demo" }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/organizations$/);
  await expect(page.locator(".admin-layout__menu-button")).toBeHidden();
  await page.goto("http://127.0.0.1:5275/admin/staff");
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tài khoản quản trị" });
  await expect(dialog.locator(".admin-layout__account-title")).toHaveCSS(
    "font-family",
    '"Be Vietnam Pro", sans-serif',
  );
  await expect(dialog.locator(".admin-layout__account-actions")).toHaveCSS(
    "gap",
    "12px",
  );
  const link = dialog.getByRole("link", { name: "Trang đặt vé →" });
  const logout = dialog.getByRole("button", { name: "Đăng xuất", exact: true });
  const linkBox = await link.boundingBox();
  const logoutBox = await logout.boundingBox();
  if (!linkBox || !logoutBox) throw new Error("Missing account actions");
  expect(logoutBox.x - (linkBox.x + linkBox.width)).toBe(12);
  expect(linkBox.height).toBe(44);
  expect(logoutBox.height).toBe(44);
  await capture(page, "admin-account-default");
  await logout.hover();
  await expect(logout).toHaveCSS("background-color", "rgb(21, 87, 201)");
  await capture(page, "admin-account-hover");
  await page.keyboard.press("Tab");
  await capture(page, "admin-account-focus");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Tài khoản", exact: true }),
  ).toBeFocused();
});
