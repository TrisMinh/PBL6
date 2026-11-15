import { expect, test } from "@playwright/test";

test("departure periods do not overlap and both price thumbs can be dragged", async ({
  page,
}) => {
  await page.goto("/trips");
  const filters = page.getByRole("region", { name: "Bộ lọc chuyến" });
  await filters.waitFor();
  for (const width of [1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const periods = await filters
      .locator(".trip-filters__periods")
      .boundingBox();
    const hour = await filters
      .locator(".trip-filters__stacked-field")
      .boundingBox();
    if (!periods || !hour) throw new Error("Missing filter controls");
    expect(hour.y).toBeGreaterThan(periods.y + periods.height);
  }
  const range = filters.locator(".price-range");
  await range.scrollIntoViewIfNeeded();
  const box = await range.boundingBox();
  if (!box) throw new Error("Missing price slider");
  await page.mouse.move(box.x + 8, box.y + 16);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + 16, { steps: 12 });
  await page.mouse.up();
  const lower = filters.getByRole("slider", { name: "Giá tối thiểu" });
  const upper = filters.getByRole("slider", { name: "Giá tối đa" });
  expect(Number(await lower.inputValue())).toBeGreaterThan(0);
  await page.mouse.move(box.x + box.width - 8, box.y + 16);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + 16, { steps: 12 });
  await page.mouse.up();
  expect(Number(await upper.inputValue())).toBeLessThan(5000000);
  await lower.focus();
  await page.keyboard.press("End");
  expect(await lower.inputValue()).toBe(await upper.inputValue());
  await page.keyboard.press("ArrowLeft");
  expect(Number(await lower.inputValue())).toBeLessThan(
    Number(await upper.inputValue()),
  );
  const from = await lower.inputValue(),
    to = await upper.inputValue();
  await filters.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
  await expect(page).toHaveURL(new RegExp(`minFare=${from}`));
  await expect(page).toHaveURL(new RegExp(`maxFare=${to}`));
  await page.reload();
  await expect(lower).toHaveValue(from);
  await expect(upper).toHaveValue(to);
  await filters.getByRole("button", { name: "Đặt lại", exact: true }).click();
  await expect(lower).toHaveValue("0");
  await expect(upper).toHaveValue("5000000");
});
