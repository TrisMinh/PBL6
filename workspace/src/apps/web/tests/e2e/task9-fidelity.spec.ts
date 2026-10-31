import { expect, test } from "@playwright/test";
import { TASK9_CASES } from "./helpers/task9Cases";
import { AdminPage } from "./pages/AdminPage";

test.use({ colorScheme: "light", reducedMotion: "reduce" });
const titles = {
  bookings: "Danh sách đơn đặt vé",
  payments: "Danh sách giao dịch thanh toán",
  refunds: "Danh sách khoản hoàn",
};
for (const resource of ["bookings", "payments", "refunds"] as const) {
  test(`Task9 ${resource} exact list columns, records and geometry`, async ({
    page,
  }) => {
    await new AdminPage(page).login();
    await page.goto(`/admin/${resource}`);
    const table = page.getByRole("table", { name: titles[resource] });
    await expect(table.locator("tbody tr")).toHaveCount(
      resource === "refunds" ? 6 : 10,
    );
    await expect(
      page.getByRole("button", { name: "Mã tra cứu · chọn mẫu" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Nhà xe/ })).toBeVisible();
    await expect(
      page.getByText("Dữ liệu mẫu • Cập nhật 19/09/2026 lúc 10:36 (UTC+7)"),
    ).toBeVisible();
    expect(
      await page
        .locator(".transaction-page__footer")
        .evaluate((element) => element.nextElementSibling?.textContent),
    ).toBe("Xóa bộ lọc");
    if ((page.viewportSize()?.width ?? 0) === 1440) {
      expect(
        (
          await page
            .getByRole("button", { name: "Xóa bộ lọc", exact: true })
            .boundingBox()
        )?.width,
      ).toBe(156);
      await expect(page.locator(".transaction-page__header h1")).toHaveCSS(
        "font-variation-settings",
        '"opsz" 14, "wdth" 100',
      );
      await expect(page.locator(".transaction-page__header h1")).toHaveCSS("font-family", '"BLUE Transaction Display", sans-serif');
      const box = await table.boundingBox();
      expect(box?.width).toBe(1112);
      expect(
        (await table.locator("tbody tr").first().boundingBox())?.height,
      ).toBe(60);
    }
  });
}
for (const taskCase of TASK9_CASES.filter((item) => "filter" in item)) {
  test(`Task9 ${taskCase.nodeId} independent filter dialog`, async ({
    page,
  }) => {
    await new AdminPage(page).login();
    await page.goto(taskCase.url);
    const title = taskCase.name.endsWith("query")
      ? "Tra cứu mẫu trong prototype"
      : taskCase.name.endsWith("org")
        ? "Chọn nhà xe"
        : "Chọn trạng thái";
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Đóng", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has("dialog")).toBe(false);
  });
}
for (const resource of ["bookings", "payments", "refunds"] as const) {
  test(`Task9 ${resource} search action and direct-dialog focus`, async ({
    page,
  }) => {
    await new AdminPage(page).login();
    await page.goto(`/admin/${resource}`);
    await expect(
      page.getByRole("table", { name: titles[resource] }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Tra cứu", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto(`/admin/${resource}?dialog=org&future=keep`);
    await expect(
      page.getByRole("dialog", { name: "Chọn nhà xe" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Nhà xe/ })).toBeFocused();
    expect(new URL(page.url()).searchParams.get("future")).toBe("keep");
  });
}
