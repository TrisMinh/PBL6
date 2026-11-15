import { expect, test } from "@playwright/test";

test("shared dropdown menus follow their own control and support keyboard selection", async ({
  page,
}) => {
  await page.goto("/");
  for (const label of ["Điểm đi", "Điểm đến", "Hành khách"]) {
    const select = page.getByLabel(label, { exact: true });
    await select.click();
    await expect(select).toHaveJSProperty("tagName", "SELECT");
    const control = await select.boundingBox();
    const option = await select.locator("option").first().boundingBox();
    if (!control || !option) throw new Error("Dropdown is not visible");
    expect(Math.abs(option.x - control.x)).toBeLessThan(20);
    expect(option.y).toBeGreaterThan(control.y + control.height);
    await page.keyboard.press("Escape");
  }
  const passengers = page.getByLabel("Hành khách", { exact: true });
  await passengers.click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(passengers).toHaveValue("2");
  await page.goto("/account/tickets");
  await page.getByRole("button", { name: "Đăng nhập bằng Google" }).click();
  const status = page.getByLabel("Trạng thái vé");
  await status.click();
  await page.waitForTimeout(180);
  await page.screenshot({
    path: test.info().outputPath("ticket-status-dropdown.png"),
    fullPage: true,
  });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(status).toHaveValue("cancelled");
  await status.selectOption("issued");
  await expect(page.locator(".account-tickets__item").first()).toBeVisible();
});
