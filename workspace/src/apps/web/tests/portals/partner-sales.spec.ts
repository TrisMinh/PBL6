import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("customer can open the partner page and save a demo registration", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop partner page");
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(menu.getByRole("link", { name: "Tìm chuyến" })).toHaveAttribute(
    "href",
    "/trips",
  );
  await menu.getByRole("link", { name: "Mở bán vé" }).click();
  await expect(page).toHaveURL(/\/partners$/);
  await expect(menu.getByRole("link", { name: "Mở bán vé" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Mở bán vé\s*trên BLUE/,
  );
  await expect(
    page.getByRole("link", { name: "Vào cổng nhà xe" }),
  ).toHaveAttribute("href", /:5174\/login$/);
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page
        .locator(".partner-sales__photo")
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".partner-sales__story-photo")).toHaveCount(4);
  for (const frame of await page.locator(".partner-sales__story-photo").all()) {
    await frame.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        frame
          .locator("img")
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("partner-sales.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page
    .getByText("Có thể bắt đầu với một tuyến không?", { exact: true })
    .click();
  await expect(
    page.getByText(/Có\. Bạn có thể thiết lập một tuyến/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Đăng ký mở bán", exact: true }).click();
  await expect(page).toHaveURL(/#dang-ky$/);
  const form = page.getByRole("form", { name: "Đăng ký mở bán" });
  await form.getByRole("button", { name: "Lưu đăng ký" }).click();
  await expect(form.getByLabel("Tên nhà xe")).toBeFocused();
  await expect(form.getByLabel("Tên nhà xe")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await form.getByLabel("Tên nhà xe").fill("Nhà xe An Phú Demo");
  await form.getByLabel("Người liên hệ").fill("Nguyễn Minh An");
  await form.getByLabel("Số điện thoại").fill("123");
  await form.getByRole("button", { name: "Lưu đăng ký" }).click();
  await expect(form.getByRole("alert")).toContainText(
    "Nhập số điện thoại Việt Nam hợp lệ",
  );
  await expect(form.getByLabel("Số điện thoại")).toBeFocused();
  await form.getByLabel("Số điện thoại").fill("0912 345 678");
  await form.getByLabel(/Email/).fill("nguyen@");
  await form.getByRole("button", { name: "Lưu đăng ký" }).click();
  await expect(form.getByLabel(/Email/)).toBeFocused();
  await expect(form.getByRole("alert")).toHaveText(
    "Nhập email đúng định dạng.",
  );
  await form.getByLabel(/Email/).fill("demo@example.invalid");
  await form.getByLabel(/Tuyến dự kiến/).fill("Hồ Chí Minh → Lâm Đồng");
  await form.getByRole("button", { name: "Lưu đăng ký" }).click();
  const status = page
    .getByRole("status")
    .filter({ hasText: "Đã lưu đăng ký trải nghiệm" });
  await expect(status).toContainText(/BLUE-NX-[A-F0-9]{8}/);
  await expect(status).toBeFocused();
  const code = (await status.innerText()).match(/BLUE-NX-[A-F0-9]{8}/)?.[0];
  expect(
    await page.evaluate(
      (reference) =>
        JSON.parse(
          sessionStorage.getItem(`blue-partner:${reference}`) ?? "null",
        ),
      code,
    ),
  ).toMatchObject({
    operator: "Nhà xe An Phú Demo",
    phone: "0912345678",
    route: "Hồ Chí Minh → Lâm Đồng",
    email: "demo@example.invalid",
  });
  await page.getByRole("button", { name: "Đăng ký khác" }).click();
  await expect(form.getByLabel("Tên nhà xe")).toHaveValue("");
  await expect(form.getByLabel("Tên nhà xe")).toBeFocused();
});
