import { expect, test } from "@playwright/test";

test("unknown URL has safe noindex recovery to the customer homepage", async ({
  page,
}) => {
  await page.goto("/missing-page");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy trang" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Không tìm thấy trang | BLUE");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  const home = page.getByRole("link", { name: "Về trang chủ", exact: true });
  await home.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", {
      name: "Mỗi hành trình đều thật giản đơn.",
      exact: true,
    }),
  ).toBeVisible();
});

test("guest admin and missing booking sessions recover through canonical routes", async ({
  page,
}) => {
  await page.goto("/admin/bookings");
  await expect(page).toHaveURL("/login");
  await expect(
    page.getByRole("heading", {
      name: "Hành trình đang chờ bạn",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/booking/missing-session/seats");
  await expect(page).toHaveURL("/trips?reason=expired");
  await expect(
    page.getByRole("heading", {
      name: "Phiên giữ chỗ đã hết hạn",
      exact: true,
    }),
  ).toBeVisible();
});
