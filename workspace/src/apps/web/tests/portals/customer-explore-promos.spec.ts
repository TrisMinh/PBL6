import { expect, test } from "@playwright/test";

test("Explore promotions move right, pause and support keyboard links and reduced motion", async ({
  page,
}) => {
  await page.goto("/explore");
  const region = page.getByRole("region", { name: "Gợi ý và ưu đãi BLUE" });
  await expect(region.getByRole("link")).toHaveCount(6);
  const track = region.locator(".explore-promos__track");
  await page.mouse.move(0, 0);
  const start = await track.evaluate(
    (el) => new DOMMatrix(getComputedStyle(el).transform).m41,
  );
  await expect
    .poll(() =>
      track.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41),
    )
    .toBeGreaterThan(start + 2);
  await region.getByRole("button", { name: "Tạm dừng dải quảng bá" }).click();
  await expect(track).toHaveCSS("animation-play-state", "paused");
  await region.getByRole("button", { name: "Chạy dải quảng bá" }).click();
  await page.mouse.move(0, 0);
  await expect(track).toHaveCSS("animation-play-state", "running");
  const route = region.getByRole("link").first();
  await route.focus();
  await expect(track).toHaveCSS("animation-name", "none");
  await route.click();
  await expect(page).toHaveURL(/originId=loc-hcm.*destinationId=loc-dalat/);
  await expect(
    page.getByRole("button", { name: "Chọn chuyến", exact: true }).first(),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore");
  await expect(track).toHaveCSS("animation-name", "none");
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const header = await page.locator(".customer-layout__header").boundingBox();
    const ticker = await region.boundingBox();
    const routes = await page.locator("#tuyen-pho-bien").boundingBox();
    expect(ticker?.width).toBe(header?.width);
    expect(ticker?.x).toBe(header?.x);
    expect(ticker?.height).toBe(44);
    if (ticker && routes)
      expect(routes.y - ticker.y - ticker.height).toBeLessThanOrEqual(24);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "../../../../docs/implementation/navigation-fix/explore-promo-ticker.png",
    fullPage: true,
  });
});
