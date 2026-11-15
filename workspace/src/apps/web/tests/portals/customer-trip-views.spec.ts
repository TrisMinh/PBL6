import { expect, test } from "@playwright/test";

test("trip view icons change density, persist and keep offer actions spaced", async ({
  page,
}) => {
  await page.goto("/trips");
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [label, mode, columns] of [
    ["Danh sách", "list", 1],
    ["Lưới nhỏ", "grid-small", 3],
    ["Lưới lớn", "grid-large", 2],
  ] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".trip-results__success")).toHaveAttribute(
      "data-view",
      mode,
    );
    expect(
      await page
        .locator(".trip-results__list")
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        ),
    ).toBe(columns);
    for (const width of [1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page
          .locator(".trip-card")
          .evaluateAll((els) =>
            els.some((el) => el.scrollWidth > el.clientWidth),
          ),
      ).toBe(false);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page
    .getByRole("button", { name: "Giá thấp nhất", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Lưới lớn", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator(".trip-highlights__offer").first().click();
  const dialog = page.getByRole("dialog", { name: "Ưu đãi cho chuyến đi" });
  const note = await dialog.locator(".trip-offer__note").boundingBox();
  const copy = await dialog
    .getByRole("button", { name: "Sao chép mã" })
    .boundingBox();
  if (!note || !copy) throw new Error("Offer controls missing");
  expect(copy.y - (note.y + note.height)).toBeGreaterThanOrEqual(20);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
