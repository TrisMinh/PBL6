import { expect, test } from "@playwright/test";

test("same-page pickup lookup scrolls smoothly and respects reduced motion", async ({
  page,
}) => {
  await page.goto("/explore");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "smooth");
  await page.evaluate(() => {
    const samples: number[] = [];
    (window as Window & { anchorSamples?: number[] }).anchorSamples = samples;
    let frames = 0;
    const sample = (): void => {
      samples.push(window.scrollY);
      if (++frames < 100) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page
    .getByRole("link", { name: "Tra cứu điểm đón, trả", exact: true })
    .click();
  await expect(page).toHaveURL(/\/explore#tinh-thanh$/);
  const section = page.locator("#tinh-thanh");
  await expect(section).toBeInViewport();
  const values = await page.evaluate(
    () => (window as Window & { anchorSamples?: number[] }).anchorSamples ?? [],
  );
  const final = await page.evaluate(() => window.scrollY);
  expect(values.some((value) => value > 5 && value < final - 20)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
  await page.goto("/explore");
  await page
    .getByRole("link", { name: "Tra cứu điểm đón, trả", exact: true })
    .click();
  await expect(section).toBeInViewport();
});
