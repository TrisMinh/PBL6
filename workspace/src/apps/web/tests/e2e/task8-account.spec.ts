import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";
import { AdminPage } from "./pages/AdminPage";

test("Task8 Admin account keyboard ownership, focus return and logout", async ({
  page,
}) => {
  await new AdminPage(page).login();
  const trigger = page.getByRole("button", { name: "Tài khoản", exact: true });
  await expect(trigger).toBeVisible();
  await expect(page.locator('a[href="/account/tickets"]')).toHaveCount(0);
  expect((await trigger.boundingBox())?.width).toBe(
    (page.viewportSize()?.width ?? 1440) < 1024 ? 44 : 124,
  );
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Tài khoản quản trị" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Đóng tài khoản" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Đăng xuất" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Đóng tài khoản" }),
  ).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await assertNoPageOverflow(page);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/\/admin\/organizations$/);
  await trigger.click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => sessionStorage.getItem("blue-mock-session")),
  ).toBeNull();
});
