import { expect, test } from "@playwright/test";

test("passengers start with editable saved profile details", async ({
  page,
}) => {
  await page.goto("/account/profile");
  await page.getByRole("button", { name: "Đăng nhập bằng Google" }).click();
  await page.getByLabel("Họ và tên", { exact: true }).fill("Nguyễn An Bình");
  await page.getByLabel("Số điện thoại liên hệ").fill("0912345678");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu hồ sơ");
  await page.goto(
    "/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=1",
  );
  await page
    .getByRole("button", { name: "Chọn chuyến", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Ghế A01", exact: true }).click();
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  const name = page.getByLabel("Họ và tên (ghế A01)", { exact: true });
  await expect(name).toHaveValue("Nguyễn An Bình");
  await expect(
    page.getByLabel("Số điện thoại (ghế A01, không bắt buộc)", { exact: true }),
  ).toHaveValue("0912345678");
  await expect(page.getByLabel("Email nhận vé", { exact: true })).toHaveValue(
    "test+review@example.invalid",
  );
  await name.fill("Trần Hành Khách");
  await page
    .getByLabel("Email nhận vé", { exact: true })
    .fill("other@example.invalid");
  await page
    .getByRole("button", { name: "Xác nhận thông tin", exact: true })
    .click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(
    page.getByRole("img", { name: /Ảnh minh họa xe của/ }),
  ).toBeVisible();
  for (const width of [1280, 1440, 1920]) {
    const heading = await page.locator(".booking-review-page__heading").boundingBox();
    const body = await page.locator(".booking-review-page__body").boundingBox();
    expect(heading).not.toBeNull();
    expect(body).not.toBeNull();
    if (heading && body) expect(body.y - heading.y - heading.height).toBeGreaterThanOrEqual(24);

    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator(".booking-review__pickup")).toBeVisible();
    const sizes = await page
      .locator(".booking-review")
      .evaluate((el) => ({
        width: el.clientWidth,
        scroll: el.scrollWidth,
        height: el.clientHeight,
        content: el.scrollHeight,
      }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
    expect(sizes.content).toBeLessThanOrEqual(sizes.height);
    await page.screenshot({
      path: `../../../../docs/implementation/navigation-fix/booking-review-${width}.png`,
      fullPage: true,
    });
  }
  await page.goBack();
  await expect(name).toHaveValue("Trần Hành Khách");
  await expect(page.getByLabel("Email nhận vé", { exact: true })).toHaveValue(
    "other@example.invalid",
  );
  await page.reload();
  await expect(name).toHaveValue("Trần Hành Khách");
});
