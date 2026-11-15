import { expect, test } from "@playwright/test";

test("home route cards lead to matching trips; search can swap, repeat and delete", async ({
  page,
}) => {
  await page.goto("/");
  const popular = page.getByRole("region", {
    name: "Danh sách tuyến đường phổ biến",
  });
  const route = popular.getByRole("link").first();
  await expect(route).toBeVisible();
  const routeHref = await route.getAttribute("href");
  const departureDate = new URL(
    routeHref ?? "",
    "http://localhost",
  ).searchParams.get("departureDate");
  expect(departureDate).toBeTruthy();
  await route.click();
  await expect(page).toHaveURL(/\/trips\?/);
  await expect(
    page.getByRole("button", { name: "Chọn chuyến", exact: true }).first(),
  ).toBeVisible();
  await page.goto("/");
  await page.getByLabel("Điểm đi", { exact: true }).selectOption("loc-hcm");
  await page.getByLabel("Điểm đến", { exact: true }).selectOption("loc-dalat");
  await page.getByRole("button", { name: "Đổi chiều hành trình" }).click();
  await expect(page.getByLabel("Điểm đi", { exact: true })).toHaveValue(
    "loc-dalat",
  );
  await expect(page.getByLabel("Điểm đến", { exact: true })).toHaveValue(
    "loc-hcm",
  );
  await page.getByRole("button", { name: "Tìm chuyến", exact: true }).click();
  await expect(page.getByLabel("Ngày đi", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Ngày đi", { exact: true }).fill(departureDate ?? "");
  await page.getByLabel("Hành khách", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: "Tìm chuyến", exact: true }).click();
  await expect(page).toHaveURL(/originId=loc-dalat/);
  await expect(
    page.getByRole("button", { name: "Chọn chuyến", exact: true }).first(),
  ).toBeVisible();
  await page.goto("/");
  await page.reload();
  const recent = page.getByRole("region", { name: "Tìm kiếm gần đây" });
  await expect(recent).toContainText("2 người");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "../../../../docs/implementation/navigation-fix/home-interactive-1440.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({
    path: "../../../../docs/implementation/navigation-fix/home-interactive-1280.png",
    fullPage: true,
  });
  await recent.getByRole("link").first().click();
  await expect(page).toHaveURL(/destinationId=loc-hcm/);
  await expect(page).toHaveURL(/passengerCount=2/);
  await page.goto("/");
  await recent
    .getByRole("button", { name: /Xóa tìm kiếm/ })
    .first()
    .click();
  await expect(recent.getByRole("link")).toHaveCount(1);
  await recent.getByRole("button", { name: "Xóa tất cả", exact: true }).click();
  await expect(recent).toHaveCount(0);
  await page.reload();
  await expect(recent).toHaveCount(0);
});
