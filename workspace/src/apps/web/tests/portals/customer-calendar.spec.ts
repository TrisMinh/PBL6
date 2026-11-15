import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("BLUE calendar selects dates, blocks past days and supports keyboard and clearing", async ({
  page,
}) => {
  await page.goto("/trips");
  const input = page.getByLabel("Ngày đi", { exact: true });
  await page.getByRole("button", { name: "Mở lịch chọn ngày" }).click();
  const dialog = page.getByRole("dialog", { name: "Lịch chọn ngày đi" });
  await expect(dialog).toBeVisible();
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(
    "en-CA",
    { timeZone: "Asia/Ho_Chi_Minh" },
  );
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  await expect(dialog.locator(`[data-date="${yesterday}"]`)).toBeDisabled();
  await dialog.locator(`[data-date="${today}"]`).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue(tomorrow);
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Mở lịch chọn ngày" }).click();
  await expect(dialog.locator(`[data-date="${tomorrow}"]`)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const title = await dialog.locator("header strong").textContent();
  await dialog.getByRole("button", { name: "Tháng sau", exact: true }).click();
  expect(await dialog.locator("header strong").textContent()).not.toBe(title);
  await dialog
    .getByRole("button", { name: "Tháng trước", exact: true })
    .click();
  await expect(dialog.locator("header strong")).toHaveText(title ?? "");
  expect(
    (await new AxeBuilder({ page }).include(".date-picker").analyze())
      .violations,
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Xóa ngày" }).click();
  await expect(input).toHaveValue("");
  await input.fill(tomorrow);
  await page
    .getByRole("region", { name: "Tìm kiếm chuyến xe" })
    .getByRole("button", { name: "Tìm chuyến", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`departureDate=${tomorrow}`));
  await page.goto("/");
  await page.getByLabel("Điểm đi", { exact: true }).selectOption("loc-hcm");
  await page.getByLabel("Điểm đến", { exact: true }).selectOption("loc-dalat");
  await page.getByRole("button", { name: "Mở lịch chọn ngày" }).click();
  await dialog.locator(`[data-date="${tomorrow}"]`).click();
  await page.getByRole("button", { name: "Tìm chuyến", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/trips\\?.*departureDate=${tomorrow}`),
  );
});
