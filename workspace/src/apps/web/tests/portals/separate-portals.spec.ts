import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { BookingReviewPage } from "../e2e/pages/BookingReviewPage";
import { PaymentPage } from "../e2e/pages/PaymentPage";

test("customer registers verifies and signs in again after a full reload", async ({
  page,
}) => {
  const email = `demo-${Date.now()}@example.invalid`;
  await page.goto("/register");
  await page.getByLabel("Họ và tên", { exact: true }).fill("Khách Demo Mới");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0912345678");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("DemoPass123");
  await page
    .getByLabel("Xác nhận mật khẩu", { exact: true })
    .fill("DemoPass123");
  await page.getByRole("checkbox", { name: /Tôi đồng ý/ }).check();
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await page.getByRole("link", { name: "Tiếp tục xác minh email" }).click();
  await page.getByLabel("Mã xác minh").fill("123456");
  await page.getByRole("button", { name: "Xác nhận email" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Email đã được xác minh",
  );
  await page.goto("/login");
  await expect(page.getByText(/Kịch bản đăng nhập mô phỏng/)).toHaveCount(0);
  await page
    .getByLabel("Email hoặc số điện thoại", { exact: true })
    .fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("DemoPass123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/tickets$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vé của tôi", exact: true }),
  ).toBeVisible();
});

async function fits(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function staffLogin(
  page: Page,
  target: "operator" | "admin",
): Promise<void> {
  await page.goto(
    `http://127.0.0.1:${target === "operator" ? 5274 : 5275}/login`,
  );
  await page.getByRole("button", { name: "Điền tài khoản demo" }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(
    target === "operator" ? /\/operator\/trips$/ : /\/admin\/organizations$/,
  );
}
test("production customer mock supports visible social login and excludes both staff portals", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("home-heading")).toBeVisible();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Đăng nhập bằng Facebook" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const password = page.getByLabel("Mật khẩu", { exact: true });
  await expect(password).toHaveAttribute("aria-invalid", "true");
  const visibility = page.getByRole("button", { name: "Hiện mật khẩu" });
  const inputBounds = await password.boundingBox();
  const buttonBounds = await visibility.boundingBox();
  if (!inputBounds || !buttonBounds)
    throw new Error("Missing password controls");
  expect(buttonBounds.y).toBeGreaterThanOrEqual(inputBounds.y);
  expect(buttonBounds.y + buttonBounds.height).toBeLessThanOrEqual(
    inputBounds.y + inputBounds.height,
  );
  await visibility.click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Đăng nhập bằng Google" }).click();
  await expect(page).toHaveURL(/\/account\/tickets$/);
  await expect(
    page.getByRole("main").getByRole("button", { name: "Đăng xuất" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .getByRole("link", { name: "Khám phá" })
    .click();
  await expect(page).toHaveURL(/\/explore$/);
  const account = page.getByRole("button", { name: "Tài khoản", exact: true });
  await account.focus();
  await page.keyboard.press("Enter");
  const logout = page.getByRole("menuitem", { name: "Đăng xuất" });
  await expect(logout).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();
  await account.click();
  await logout.click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => sessionStorage.getItem("blue-mock-session")),
  ).toBeNull();
  await page.goto("/account/tickets");
  await expect(page).toHaveURL(/\/login$/);
  await fits(page);
  for (const path of ["/operator/trips", "/admin/organizations"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Không tìm thấy trang" }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("production customer checkout has bank selection and completes mock payment", async ({
  page,
}) => {
  const review = new BookingReviewPage(page);
  await review.start();
  await review.continue();
  const gateway = page.getByRole("region", { name: "VNPay mô phỏng" });
  await gateway.getByRole("tab", { name: "Thẻ ATM / Ngân hàng" }).click();
  await expect(gateway.getByText("Vietcombank", { exact: true })).toBeVisible();
  await fits(page);
  const payment = new PaymentPage(page);
  await payment.pay();
  await payment.expectState("Thanh toán thành công");
  expect(await payment.ticketCodes()).toHaveLength(2);
});
test("customer support and legal links render and request saves locally", async ({
  page,
}) => {
  await page.goto("/support");
  await page.getByLabel("Email liên hệ").fill("demo@example.invalid");
  await page
    .getByLabel("Nội dung cần hỗ trợ")
    .fill("Tôi cần kiểm tra thông tin chuyến đi trong demo.");
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page.getByRole("status")).toContainText("BLUE-SUP-");
  await fits(page);
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { level: 1, name: "Chính sách bảo mật" }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
});
test("operator has independent login resources organization settlement and no customer routes", async ({
  page,
}) => {
  await staffLogin(page, "operator");
  await expect(
    page.getByRole("heading", { name: "Lịch chuyến", level: 1, exact: true }),
  ).toBeVisible();
  for (const [path, title] of [
    ["/operator/organization", "Tổ chức & thành viên"],
    ["/operator/settlements", "Đối soát nhà xe"],
  ]) {
    await page.goto(`http://127.0.0.1:5274${path}`);
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await fits(page);
  }
  await page.goto("http://127.0.0.1:5274/trips");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy trang" }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:5274/admin/organizations");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy trang" }),
  ).toBeVisible();
});
test("admin has independent login and all transaction families in production mock", async ({
  page,
}) => {
  await staffLogin(page, "admin");
  await expect(
    page.getByRole("heading", { name: "Tổ chức", exact: true }),
  ).toBeVisible();
  await fits(page);
  for (const [path, title] of [
    ["staff", "Nhân viên"],
    ["bookings", "Đơn đặt vé"],
    ["payments", "Thanh toán"],
    ["refunds", "Hoàn tiền"],
  ]) {
    await page.goto(`http://127.0.0.1:5275/admin/${path}`);
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await fits(page);
  }
  await page.goto("http://127.0.0.1:5275/operator/trips");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy trang" }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:5275/payment/not-a-booking/vnpay");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy trang" }),
  ).toBeVisible();
});
