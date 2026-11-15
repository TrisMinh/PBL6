import { expect, test } from "@playwright/test";

test("Find trips navigation opens the complete catalogue and its filters", async ({
  page,
}) => {
  await page.goto("/tickets/lookup");
  await page
    .getByRole("navigation", { name: "Điều hướng chính", exact: true })
    .getByRole("link", { name: "Tìm chuyến", exact: true })
    .click();
  await expect(page).toHaveURL(/\/trips$/);
  await expect(
    page.getByRole("heading", { name: "Tất cả chuyến xe" }),
  ).toBeVisible();
  await expect(page.locator(".trip-card")).toHaveCount(6);
  const initial = await page.locator(".trip-results__count").textContent();
  const search = page.getByRole("region", { name: "Tìm kiếm chuyến xe" });
  await search.getByLabel("Điểm đi", { exact: true }).selectOption("loc-hanoi");
  await search
    .getByLabel("Điểm đến", { exact: true })
    .selectOption("loc-danang");
  await search.getByRole("button", { name: "Tìm chuyến", exact: true }).click();
  await expect(page).toHaveURL(/browse=1/);
  await expect(page.locator(".trip-card__route").first()).toHaveText(
    "Hà Nội → Đà Nẵng",
  );
  expect(await page.locator(".trip-results__count").textContent()).not.toBe(
    initial,
  );
  const filters = page.getByRole("region", { name: "Bộ lọc chuyến" });
  await filters.getByLabel("Loại xe", { exact: true }).selectOption("cabin-22");
  await filters.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
  await expect(page).toHaveURL(/vehicleType=cabin-22/);
  expect(
    await page
      .locator(".trip-card")
      .evaluateAll((els) =>
        els.every((el) => el.getAttribute("data-vehicle-type") === "cabin-22"),
      ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator(".trip-card__route").first()).toHaveText(
    "Hà Nội → Đà Nẵng",
  );
  await page.getByRole("button", { name: "Trang sau" }).click();
  await expect(page).toHaveURL(/page=2/);
  for (const width of [1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .locator(".trip-card")
    .first()
    .getByRole("button", { name: "Chọn chuyến" })
    .click();
  await expect(page).toHaveURL(/\/booking\/.+\/seats$/);
});
