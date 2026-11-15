import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("BLUE time picker applies, cancels and clears a departure threshold", async ({
  page,
}) => {
  await page.goto("/trips");
  const input = page.getByLabel("Giờ xuất phát", { exact: true });
  const trigger = page.getByRole("button", { name: "Mở bộ chọn giờ" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Chọn giờ khởi hành" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Giờ", { exact: true }).selectOption("09");
  await dialog.getByLabel("Phút", { exact: true }).selectOption("30");
  expect(
    (await new AxeBuilder({ page }).include(".time-picker").analyze())
      .violations,
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Chọn giờ", exact: true }).click();
  await expect(input).toHaveValue("09:30");
  await expect(dialog).toBeHidden();
  await trigger.click();
  await dialog.getByLabel("Giờ", { exact: true }).selectOption("15");
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("09:30");
  await page.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
  await expect(page).toHaveURL(/departureHour=09%3A30/);
  await page.reload();
  await expect(input).toHaveValue("09:30");
  await trigger.click();
  await dialog.getByRole("button", { name: "Xóa giờ" }).click();
  await expect(input).toHaveValue("");
  await page.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
  expect(new URL(page.url()).searchParams.has("departureHour")).toBe(false);
  for (const width of [1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await trigger.click();
    const box = await dialog.boundingBox();
    if (!box) throw new Error("Picker hidden");
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(1000);
    await page.keyboard.press("Escape");
  }
});
