import { expect, test, type Page } from "@playwright/test";

import { AdminPage } from "./pages/AdminPage";

test.use({ colorScheme: "light", reducedMotion: "reduce" });

function watchRuntime(page: Page): string[] {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console:${message.text()}`);
  });
  return failures;
}

async function installAdminScenarioControl(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const scenario = sessionStorage.getItem("admin-e2e-scenario");
      if (!scenario || !url.includes("/api/v1/admin/"))
        return originalFetch(input, init);
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      headers.set("x-mock-scenario", scenario);
      return originalFetch(input, { ...init, headers });
    };
  });
}

async function fillOrganization(page: Page): Promise<void> {
  await page.getByLabel("Tên hiển thị").fill("BLUE E2E Transit");
  await page.getByLabel("Tên pháp lý").fill("BLUE E2E Transit");
  await page.getByLabel("Mã số thuế").fill("1234567890");
  await page.getByLabel("Địa chỉ").fill("Đà Nẵng");
  await page.getByLabel("Email liên hệ").fill("admin-e2e@example.invalid");
  await page.getByLabel("Số điện thoại").fill("0912345678");
}

function expectSearchParams(
  page: Page,
  expected: Record<string, string>,
): void {
  const params = new URL(page.url()).searchParams;
  for (const [key, value] of Object.entries(expected))
    expect(params.get(key)).toBe(value);
}

test.describe("Admin portal final verification — FR-030..FR-034 @admin", () => {
  test.describe.configure({ mode: "serial" });
  test("admin login, organization detail and create preserve URL state", async ({
    page,
  }) => {
    const failures = watchRuntime(page);
    const admin = new AdminPage(page);
    await admin.login();
    await admin.expectResponsiveTable("Danh sách tổ chức");
    await page.getByRole("link", { name: "BlueLine Co." }).click();
    await expect(
      page.getByRole("heading", { name: "BlueLine Co." }),
    ).toBeVisible();
    await page.goto(
      "/admin/organizations?query=BLUE&future=keep&dialog=create",
    );
    await expect(
      page.getByRole("dialog", { name: "Thêm tổ chức" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByRole("dialog", { name: "Thêm tổ chức" })
          .evaluate((dialog) => dialog.contains(document.activeElement)),
      )
      .toBe(true);
    await admin.expectMinimumTarget("Đóng hộp thoại");
    await page.getByRole("button", { name: "Đóng hộp thoại" }).click();
    expectSearchParams(page, { query: "BLUE", future: "keep" });
    expect(page.url()).not.toContain("dialog=");

    await page.getByRole("button", { name: "Thêm tổ chức" }).click();
    await fillOrganization(page);
    await page.getByRole("button", { name: "Tạo tổ chức" }).click();
    await expect(
      page.getByText("Đã tạo tổ chức.", { exact: true }),
    ).toBeVisible();
    expectSearchParams(page, { query: "BLUE", future: "keep" });
    expect(page.url()).not.toContain("dialog=");
    await expect(
      page.getByRole("link", { name: "BLUE E2E Transit" }),
    ).toBeVisible();
    await admin.expectViewportQuality();
    expect(failures).toEqual([]);
  });

  test("staff list, detail, create and edit use one responsive dialog flow", async ({
    page,
  }) => {
    const failures = watchRuntime(page);
    const admin = new AdminPage(page);
    await admin.login();
    await admin.navigate("Nhân viên", "/admin/staff");
    await admin.expectResponsiveTable("Danh sách nhân viên");
    await page.getByRole("link", { name: "Nguyễn Hoàng Long" }).click();
    await expect(
      page.getByRole("heading", { name: "Chi tiết nhân viên" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Quay lại danh sách" }).click();

    await page.goto("/admin/staff?status=active&future=keep&dialog=create");
    await expect(
      page.getByRole("dialog", { name: "Thêm thành viên" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByRole("dialog", { name: "Thêm thành viên" })
          .evaluate((dialog) => dialog.contains(document.activeElement)),
      )
      .toBe(true);
    const createDialog = page.getByRole("dialog", { name: "Thêm thành viên" });
    await createDialog.getByLabel("Nhà xe").selectOption("ORG-002");
    await createDialog.getByLabel("Nhân viên").selectOption("USR-0018");
    await createDialog.getByLabel("Vai trò").selectOption("OPERATOR_ADMIN");
    await createDialog.getByLabel("Lý do", { exact: true }).fill("Phân công");
    await createDialog
      .getByRole("button", { name: "Thêm thành viên", exact: true })
      .click();
    await expect(
      page.getByText("Đã thêm nhân viên.", { exact: true }),
    ).toBeVisible();
    expectSearchParams(page, { status: "active", future: "keep" });
    await page.getByRole("link", { name: "Nguyễn Hoàng Long" }).click();
    await page
      .getByRole("button", { name: "Chỉnh sửa thông tin" })
      .first()
      .click();
    await expect(
      page.getByRole("dialog", { name: "Chỉnh sửa thông tin" }),
    ).toBeVisible();
    await page.getByLabel("Lý do thay đổi").fill("Điều chỉnh vai trò");
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(
      page.getByText("Đã cập nhật nhân viên.", { exact: true }),
    ).toBeVisible();
    await admin.expectViewportQuality();
    expect(failures).toEqual([]);
  });

  test("@critical booking, payment and refund lists navigate to related details", async ({
    page,
  }) => {
    const failures = watchRuntime(page);
    const admin = new AdminPage(page);
    await admin.login("/admin/bookings");
    await admin.expectResponsiveTable("Danh sách đơn đặt vé");
    await page.getByRole("link", { name: "BK-260916-018" }).click();
    await expect(
      page.getByRole("heading", { name: "Chi tiết đơn đặt vé" }),
    ).toBeVisible();

    await admin.navigate("Thanh toán", "/admin/payments");
    await admin.expectResponsiveTable("Danh sách giao dịch thanh toán");
    await page.getByRole("link", { name: "PAY-260916-018" }).click();
    await expect(
      page.getByRole("heading", { name: "Chi tiết thanh toán" }),
    ).toBeVisible();

    await admin.navigate("Hoàn tiền", "/admin/refunds");
    await admin.expectResponsiveTable("Danh sách khoản hoàn");
    await page.getByRole("link", { name: "RF-260916-018" }).click();
    await expect(
      page.getByRole("heading", { name: "Chi tiết hoàn tiền" }),
    ).toBeVisible();
    await admin.expectViewportQuality();
    expect(failures).toEqual([]);
  });

  test("forbidden is terminal while service error offers retry", async ({
    page,
  }) => {
    const failures = watchRuntime(page);
    await installAdminScenarioControl(page);
    const admin = new AdminPage(page);
    await admin.login();
    await page.evaluate(() =>
      sessionStorage.setItem("admin-e2e-scenario", "forbidden"),
    );
    await page.goto("/admin/bookings");
    await expect(
      page.getByRole("heading", { name: "Bạn chưa có quyền truy cập" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Thử lại" })).toHaveCount(0);

    await page.evaluate(() =>
      sessionStorage.setItem("admin-e2e-scenario", "error"),
    );
    await page.goto("/admin/payments");
    await expect(
      page.getByRole("heading", { name: "Chưa tải được dữ liệu" }),
    ).toBeVisible();
    await admin.expectMinimumTarget("Thử lại");
    await page.evaluate(() => sessionStorage.removeItem("admin-e2e-scenario"));
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(
      page.getByRole("table", { name: "Danh sách giao dịch thanh toán" }),
    ).toBeVisible();
    await admin.expectViewportQuality();
    expect(failures).toEqual([
      "console:Failed to load resource: the server responded with a status of 403 (Forbidden)",
      "console:Failed to load resource: the server responded with a status of 503 (Service Unavailable)",
    ]);
  });
});
