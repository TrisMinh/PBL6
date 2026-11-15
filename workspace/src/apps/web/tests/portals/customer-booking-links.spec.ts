import { expect, test } from "@playwright/test";

test("booking links consistently open and focus the search form", async ({
  page,
}) => {
  for (const path of ["/tickets/lookup", "/explore", "/partners", "/"]) {
    await page.goto(path);
    await page
      .locator(".customer-layout__actions")
      .getByRole("link", { name: "Đặt vé", exact: true })
      .click();
    await expect(page).toHaveURL(/\/#booking-search$/);
    await expect(page.getByLabel("Điểm đi", { exact: true })).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Tìm chuyến", exact: true }),
    ).toBeInViewport();
  }
  await page
    .getByRole("contentinfo", { name: "Thông tin BLUE" })
    .getByRole("link", { name: "Đặt vé", exact: true })
    .click();
  await expect(page).toHaveURL(/\/#booking-search$/);
  await expect(page.getByLabel("Điểm đi", { exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByLabel("Điểm đi", { exact: true })).toBeFocused();
  await page.getByLabel("Điểm đi", { exact: true }).selectOption("loc-hcm");
  await page.getByLabel("Điểm đến", { exact: true }).selectOption("loc-dalat");
  const date = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  await page.getByLabel("Ngày đi", { exact: true }).fill(date);
  await page.getByRole("button", { name: "Tìm chuyến", exact: true }).click();
  await expect(page).toHaveURL(/\/trips\?.*originId=loc-hcm/);
  await expect(
    page.getByRole("heading", { name: "Thông tin tìm kiếm chưa hợp lệ" }),
  ).toHaveCount(0);
});
