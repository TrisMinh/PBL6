import { expect, test } from "@playwright/test";

test("lookup errors slide in as a toast, expire and can be retried", async ({
  page,
}) => {
  await page.goto("/tickets/lookup");
  await page.getByLabel("Mã đặt vé", { exact: true }).fill("BLUE-ABCDEF12");
  await page
    .getByLabel("Email hoặc số điện thoại đã đặt vé")
    .fill("nobody@example.invalid");
  const submit = page.getByRole("button", { name: "Tra cứu vé", exact: true });
  const toast = page.locator(".app-toast");
  const form = page.locator(".ticket-lookup__form");
  const before = await form.boundingBox();
  await submit.click();
  await expect(toast).toContainText("Không tìm thấy vé phù hợp");
  await page.waitForTimeout(250);
  const box = await toast.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error("Toast bounds unavailable");
  expect(box.x).toBeGreaterThan(viewport.width / 2);
  expect(await form.boundingBox()).toEqual(before);
  await page.screenshot({
    path: test.info().outputPath("lookup-error-toast.png"),
    fullPage: true,
  });
  await expect(toast).toHaveCount(0, { timeout: 4000 });
  await submit.click();
  await expect(toast).toBeVisible();
  await page.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(toast).toHaveCount(0);
  await page.getByLabel("Mã đặt vé", { exact: true }).fill("");
  await submit.click();
  await expect(page.getByLabel("Mã đặt vé", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(toast).toHaveCount(0);
});
