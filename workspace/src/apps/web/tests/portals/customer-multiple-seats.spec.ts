import { expect, test } from "@playwright/test";

test("a search for one passenger can select two seats and continue with two passengers", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Đăng nhập bằng Google" }).click();
  await page.goto(
    "/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=1",
  );
  await page
    .getByRole("button", { name: "Chọn chuyến", exact: true })
    .first()
    .click();
  const next = page.getByRole("button", { name: "Tiếp tục", exact: true });
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Ghế A01", exact: true }).click();
  await page.getByRole("button", { name: "Ghế A02", exact: true }).click();
  await expect(next).toBeEnabled();
  // Simulate a draft saved before selected seats and passenger count were synchronized.
  await page.evaluate(() => {
    const draft = JSON.parse(
      sessionStorage.getItem("blue-booking-draft") ?? "{}",
    );
    draft.state.draft.passengerCount = 1;
    sessionStorage.setItem("blue-booking-draft", JSON.stringify(draft));
    const db = JSON.parse(
      sessionStorage.getItem("blue-mock-booking-db") ?? "{}",
    );
    for (const session of db.sessions ?? []) session.passengerCount = 1;
    sessionStorage.setItem("blue-mock-booking-db", JSON.stringify(db));
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Ghế A01", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Ghế A02", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(next).toBeEnabled();
  await page.getByRole("button", { name: "Ghế A01", exact: true }).click();
  await page.getByRole("button", { name: "Ghế A02", exact: true }).click();
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Ghế A01", exact: true }).click();
  await page.getByRole("button", { name: "Ghế A02", exact: true }).click();
  await next.click();
  await expect(page).toHaveURL(/\/passengers$/);
  await page
    .getByLabel("Họ và tên (ghế A01)", { exact: true })
    .fill("Nguyễn Minh An");
  await page
    .getByLabel("Họ và tên (ghế A02)", { exact: true })
    .fill("Trần Thu Hà");
  await page
    .getByLabel("Số điện thoại (ghế A01, không bắt buộc)", { exact: true })
    .fill("0912345678");
  await page
    .getByLabel("Email nhận vé", { exact: true })
    .fill("test+review@example.invalid");
  await page
    .getByRole("button", { name: "Xác nhận thông tin", exact: true })
    .click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(
    page
      .getByRole("list", { name: "Hành khách theo ghế" })
      .getByRole("listitem"),
  ).toHaveCount(2);
  await expect(page.locator(".booking-summary__selection")).toContainText(
    "2 hành khách",
  );
  await expect(page.locator(".booking-summary__total")).toContainText(
    "640.000",
  );
  await page.getByRole("button", { name: /Tiếp tục thanh toán/ }).click();
  await page.getByText("Bản trải nghiệm · Mô phỏng kết quả ngân hàng").click();
  await page
    .getByRole("button", { name: "Xác nhận thanh toán mô phỏng" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Thanh toán thành công", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Xem vé BLUE-/ })).toHaveCount(2);
  const closeToast = page.getByRole("button", { name: "Đóng thông báo" });
  if (await closeToast.isVisible()) await closeToast.click();
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const bounds = await page.locator(".payment-result").evaluate((el) => ({
      width: el.clientWidth,
      scroll: el.scrollWidth,
      height: el.clientHeight,
      content: el.scrollHeight,
    }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
    expect(bounds.content).toBeLessThanOrEqual(bounds.height);
    await page.screenshot({
      path: `../../../../docs/implementation/navigation-fix/payment-result-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("link", { name: /Xem vé BLUE-/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Vé điện tử", exact: true }),
  ).toBeVisible();
});
