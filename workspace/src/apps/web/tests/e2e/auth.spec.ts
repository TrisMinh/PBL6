import { expect, test } from "@playwright/test";

import { ADMIN_EMAIL, AuthPage, CUSTOMER_EMAIL } from "./pages/AuthPage";
import { TicketPage } from "./pages/TicketPage";

test.describe("Mock auth and account ticket history — FR-020/FR-021", () => {
  test("customer returns to guarded history and opens only an owned issued ticket", async ({
    page,
  }) => {
    const tickets = new TicketPage(page),
      bookingCode = await tickets.issued(),
      auth = new AuthPage(page);
    await page.goto("/account/tickets");
    await expect(page).toHaveURL(/\/login$/);
    await auth.expectMockOnly();
    await auth.login();
    await expect(page).toHaveURL(/\/account\/tickets$/);
    await expect(
      page.getByRole("heading", { name: "Vé của tôi", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("2 vé", { exact: true })).toBeVisible();
    await page
      .getByRole("link", { name: /Xem vé BLUE-/ })
      .first()
      .click();
    await tickets.expectIssued();
    expect(page.url()).not.toContain(bookingCode);
    const stored = await auth.session();
    expect(stored).not.toBeNull();
    expect(stored ?? "").not.toContain(CUSTOMER_EMAIL);
    expect(stored ?? "").not.toContain("password");
    expect(stored ?? "").not.toContain("BlueDemo2026");
  });

  test("one admin follows a canonical intended route while customer is forbidden", async ({
    page,
  }) => {
    const auth = new AuthPage(page);
    await page.goto("/admin/bookings");
    await expect(page).toHaveURL(/\/login$/);
    await auth.login(ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/admin\/bookings$/);
    await expect(
      page.getByRole("heading", { name: "Đơn đặt vé", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => sessionStorage.removeItem("blue-mock-session"));
    await auth.openLogin();
    await auth.login();
    await page.goto("/admin/bookings");
    await expect(
      page.getByRole("heading", { name: "403 — Không có quyền truy cập" }),
    ).toBeVisible();
  });

  test("OAuth error is recoverable and register/forgot keep neutral responses", async ({
    page,
  }) => {
    const auth = new AuthPage(page);
    await auth.openLogin();
    await page.getByLabel("Kịch bản đăng nhập mô phỏng").selectOption("error");
    await page
      .getByRole("button", { name: "Google (mô phỏng)", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("thử lại");
    expect(await auth.session()).toBeNull();

    await page.goto("/register");
    await page.getByLabel("Họ và tên", { exact: true }).fill("Người Dùng Thử");
    await page.getByLabel("Số điện thoại", { exact: true }).fill("0912345678");
    await page
      .getByLabel("Email", { exact: true })
      .fill("unknown@example.invalid");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("Example2026");
    await page
      .getByLabel("Xác nhận mật khẩu", { exact: true })
      .fill("Example2026");
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Yêu cầu mô phỏng đã được tiếp nhận",
    );
    expect(await auth.session()).toBeNull();

    await page.goto("/forgot-password");
    await page
      .getByLabel("EMAIL HOẶC SỐ ĐIỆN THOẠI", { exact: true })
      .fill("unknown@example.invalid");
    await page.getByRole("button", { name: "Gửi hướng dẫn" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Yêu cầu mô phỏng đã được tiếp nhận",
    );
    expect(await auth.session()).toBeNull();
  });
});
