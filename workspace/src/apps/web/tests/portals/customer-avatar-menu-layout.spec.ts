import { expect, test } from "@playwright/test";

test("opening the avatar menu does not lock page scrolling or move the layout", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Đăng nhập bằng Google" }).click();
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/explore");
    const header = page.locator(".customer-layout__header");
    const heading = page.getByRole("heading", {
      name: "Khám phá điểm đến",
      exact: true,
    });
    const beforeHeader = await header.boundingBox();
    const beforeHeading = await heading.boundingBox();
    const avatar = page.getByRole("button", { name: "Tài khoản", exact: true });
    await avatar.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.locator("body")).not.toHaveAttribute(
      "data-scroll-locked",
    );
    const afterHeader = await header.boundingBox();
    const afterHeading = await heading.boundingBox();
    expect(afterHeader?.x).toBe(beforeHeader?.x);
    expect(afterHeader?.width).toBe(beforeHeader?.width);
    expect(afterHeading?.x).toBe(beforeHeading?.x);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(avatar).toBeFocused();
    await avatar.click();
    await heading.click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  await page.getByRole("menuitem", { name: "Hồ sơ cá nhân" }).click();
  await expect(page).toHaveURL(/\/account\/profile$/);
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
