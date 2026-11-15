import { expect, test } from "@playwright/test";

test("VNPay shows payment choices and waits for confirmation without another continue button", async ({
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
  const summaryFormat = (): Promise<string[][]> =>
    page.locator(".booking-summary").evaluate((root) => {
      const selectors = [
        ":scope",
        ".booking-summary__header",
        ".booking-summary__header h2",
        ".booking-summary__timer",
        ".booking-summary__operator",
        ".booking-summary__operator-icon",
        ".booking-summary__journey",
        ".booking-summary__details",
        ".booking-summary__payment-method",
        ".booking-summary__back",
      ];
      return selectors.map((selector) => {
        const node =
          selector === ":scope" ? root : root.querySelector(selector);
        if (!node) throw new Error(`Missing ${selector}`);
        const style = getComputedStyle(node);
        return [
          selector,
          ...[
            "padding",
            "gap",
            "borderRadius",
            "fontSize",
            "fontWeight",
            "backgroundColor",
            "minHeight",
            "minWidth",
            "alignItems",
          ].map((key) =>
            style.getPropertyValue(
              key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
            ),
          ),
        ];
      });
    });
  const reviewFormat = await summaryFormat();
  await page.getByRole("button", { name: /Tiếp tục thanh toán/ }).click();
  await expect(
    page.getByRole("heading", { name: "Thanh toán đơn đặt vé" }),
  ).toBeVisible();
  expect(await summaryFormat()).toEqual(reviewFormat);
  await expect(
    page.getByRole("button", { name: "Chọn phương thức thanh toán" }),
  ).toHaveCount(0);
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole("tab", { name: "VNPay QR" })).toBeVisible();
    await expect(
      page.getByText("Chờ xác nhận thanh toán", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tiếp tục đến VNPay", exact: true }),
    ).toHaveCount(0);
    const sizes = await page
      .locator(".payment-page__checkout")
      .evaluate((el) => ({ width: el.clientWidth, content: el.scrollWidth }));
    expect(sizes.content).toBeLessThanOrEqual(sizes.width);
    await page.screenshot({
      path: `../../../../docs/implementation/navigation-fix/vnpay-checkout-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("tab", { name: "Thẻ ATM / Ngân hàng" }).click();
  await page.getByRole("radio", { name: /Vietcombank/ }).check();
  await page.getByRole("tab", { name: "Thẻ quốc tế" }).click();
  await expect(
    page.getByText("Thẻ thanh toán quốc tế", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "VNPay QR" }).click();
  await expect(
    page.getByText("Chờ xác nhận thanh toán", { exact: true }),
  ).toBeVisible();
  await page.getByText("Bản trải nghiệm · Mô phỏng kết quả ngân hàng").click();
  await page
    .getByRole("button", { name: "Xác nhận thanh toán mô phỏng" })
    .click();
  await expect(page).toHaveURL(/vnpay\/return/);
  await expect(
    page.getByRole("heading", { name: "Thanh toán thành công", exact: true }),
  ).toBeVisible();
});
