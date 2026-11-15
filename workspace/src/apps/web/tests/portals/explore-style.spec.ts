import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Explore has distinct destination content and keeps province lookup usable", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop design correction only.");
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/explore");
  await expect(page.locator(".explore__province-card")).toHaveCount(4);
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByRole("heading", { level: 1, name: "Khám phá điểm đến" }),
  ).toBeVisible();
  await expect(
    page.locator(".home-hero,.product-truths,.popular-routes,.support-banner"),
  ).toHaveCount(0);
  await expect(page.locator(".explore__intro h1")).toHaveCSS(
    "font-family",
    '"Be Vietnam Pro", sans-serif',
  );
  await expect(page.locator(".explore__intro h1")).toHaveCSS(
    "font-size",
    "36px",
  );
  await expect(page.locator(".customer-layout__header")).toHaveCSS(
    "position",
    "relative",
  );
  await expect(page.locator(".explore-landing > .explore__notice")).toHaveCount(
    0,
  );
  await expect(page.locator(".home-footer")).toHaveCount(1);
  await expect(page.locator(".customer-layout__footer")).toHaveCount(0);
  const routeSection = page.getByRole("region", {
    name: "Tuyến đường phổ biến",
  });
  await expect(routeSection.getByRole("link")).toHaveCount(6);
  const rail = routeSection.locator(".explore-discovery__rail");
  await routeSection
    .getByRole("button", { name: "Xem tuyến tiếp theo" })
    .click();
  await expect
    .poll(() => rail.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);
  await expect(
    routeSection.getByRole("button", { name: "Xem tuyến trước" }),
  ).toBeEnabled();
  await routeSection.getByRole("button", { name: "Xem tuyến trước" }).click();
  await expect.poll(() => rail.evaluate((node) => node.scrollLeft)).toBe(0);
  await expect(
    page
      .getByRole("region", { name: "Ưu đãi và mẹo săn vé" })
      .getByRole("link"),
  ).toHaveCount(3);
  await expect(
    page.getByRole("region", { name: "Thanh toán online" }).locator("img"),
  ).toHaveCount(3);
  await expect(
    page.getByRole("region", { name: "Bến xe khách" }).getByRole("link"),
  ).toHaveCount(4);
  await expect(
    page.getByRole("region", { name: "Cẩm nang đi xe" }).getByRole("article"),
  ).toHaveCount(3);
  const artwork = page.locator(".explore-landing img");
  await expect(artwork).toHaveCount(19);
  for (const image of await artwork.all()) {
    await image.locator("..").scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  await rail.evaluate((node) =>
    node.scrollTo({ left: 0, behavior: "instant" }),
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  const images = await page
    .locator(".explore-landing img")
    .evaluateAll((nodes) =>
      nodes.map(
        (node) =>
          node instanceof HTMLImageElement &&
          node.complete &&
          node.naturalWidth > 0 &&
          !node.src.includes("figma.com"),
      ),
    );
  expect(images.every(Boolean)).toBe(true);
  await page.screenshot({
    path: info.outputPath("explore-desktop.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("searchbox", { name: "Tìm tỉnh, thành" })
    .fill("lam dong");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(page.locator(".explore__province-card")).toHaveCount(1);
  await expect(page).toHaveURL(/q=lam\+dong/);
  await page.reload();
  await expect(page.locator(".explore__province-card")).toHaveCount(1);
  await page.getByRole("link", { name: /Lâm Đồng.*Xem điểm đón, trả/ }).click();
  await expect(page).toHaveURL(/\/explore\/lam-dong$/);
  const directory = page.getByRole("region", {
    name: "Điểm đón và điểm trả",
    exact: true,
  });
  await expect(directory.getByRole("article")).toHaveCount(3);
  await directory.getByRole("button", { name: /^Điểm đón/ }).click();
  await expect(page).toHaveURL(/service=pickup$/);
  await expect(directory.getByRole("article")).toHaveCount(2);
  await directory.getByRole("button", { name: /^Điểm trả/ }).click();
  await expect(page).toHaveURL(/service=dropoff$/);
  await expect(directory.getByRole("article")).toHaveCount(2);
  await page.reload();
  await expect(
    directory.getByRole("button", { name: /^Điểm trả/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("link", { name: "Tất cả tỉnh, thành", exact: true })
    .click();
  await expect(page.locator(".explore__province-card")).toHaveCount(4);

  await routeSection
    .getByRole("link", { name: /TP\. Hồ Chí Minh → Đà Lạt/ })
    .click();
  await expect(page).toHaveURL(
    /\/trips\?originId=loc-hcm&destinationId=loc-dalat/,
  );
  await expect(
    page.getByRole("button", { name: "Chọn chuyến" }).first(),
  ).toBeVisible();
  await page.goBack();

  await page.getByRole("link", { name: /Bến Thông Đà Lạt/ }).click();
  await expect(page).toHaveURL(/\/explore\/lam-dong#ben-xe-dia-phuong$/);
  await expect(
    page.getByRole("heading", { name: "Bến Thông Đà Lạt" }),
  ).toBeVisible();
  await page.goBack();

  await page.getByRole("link", { name: /Hướng dẫn thanh toán VNPay/ }).click();
  await expect(page).toHaveURL(/\/offers#thanh-toan$/);
  await expect(
    page.getByRole("heading", { name: "Thanh toán VNPay" }),
  ).toBeVisible();
  await page.goBack();
  await page
    .getByRole("link", { name: /Khi giao dịch chưa có kết quả/ })
    .click();
  await expect(page).toHaveURL(/\/support#thanh-toan$/);
  await expect(
    page.getByText(/Mở lại trang kết quả và chọn kiểm tra trạng thái/),
  ).toBeVisible();
});
