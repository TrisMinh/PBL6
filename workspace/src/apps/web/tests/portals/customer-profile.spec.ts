import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("profile and settings save per customer and survive reload", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop account pages");
  await page.goto("/account/profile");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Đăng nhập bằng Google" }).click();
  await expect(page).toHaveURL(/\/account\/profile$/);
  const defaultAvatarSrc = await page
    .locator(".customer-account__avatar")
    .getAttribute("src");
  await page.getByLabel("Họ và tên", { exact: true }).fill("Nguyễn An Bình");
  await page.getByLabel("Số điện thoại liên hệ").fill("123");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByLabel("Số điện thoại liên hệ")).toBeFocused();
  await expect(page.getByRole("alert")).toContainText(
    "Nhập số điện thoại Việt Nam hợp lệ",
  );
  await page.getByLabel("Số điện thoại liên hệ").fill("0912345678");
  await page.getByLabel("Tỉnh, thành đang sống").fill("Đà Nẵng");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByRole("status")).toHaveText("Đã lưu hồ sơ.");
  await page.reload();
  await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue(
    "Nguyễn An Bình",
  );
  const avatarInput = page.getByLabel("Chọn ảnh đại diện");
  await avatarInput.setInputFiles({
    name: "wrong.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "Chọn ảnh JPG, PNG hoặc WebP.",
  );
  await avatarInput.setInputFiles(
    resolve(process.cwd(), "public/images/partners/operations.webp"),
  );
  await expect(page.locator(".customer-preferences__avatar img")).toBeVisible();
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.locator(".customer-account__avatar")).toBeVisible();
  await page.reload();
  await expect(page.locator(".customer-preferences__avatar img")).toBeVisible();
  await expect(page.locator(".customer-account__avatar")).toBeVisible();
  await page.getByRole("button", { name: "Xóa ảnh" }).click();
  await expect(page.locator(".customer-preferences__avatar img")).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Bỏ thay đổi" }).click();
  await expect(page.locator(".customer-preferences__avatar img")).toBeVisible();
  await expect(page.getByLabel("Số điện thoại liên hệ")).toHaveValue(
    "0912345678",
  );
  await page.getByLabel("Họ và tên", { exact: true }).fill("Thay đổi chưa lưu");
  await page.getByRole("button", { name: "Bỏ thay đổi" }).click();
  await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue(
    "Nguyễn An Bình",
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath("customer-profile.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page
    .getByRole("navigation", { name: "Tài khoản của tôi" })
    .getByRole("link", { name: "Cài đặt", exact: true })
    .click();
  const offers = page.getByRole("switch", { name: "Tin ưu đãi" });
  await offers.check();
  await page.getByRole("button", { name: "Lưu tùy chọn" }).click();
  await expect(page.getByRole("status")).toHaveText("Đã lưu tùy chọn.");
  await page
    .getByRole("navigation", { name: "Tài khoản của tôi" })
    .getByRole("link", { name: "Vé của tôi" })
    .click();
  const results = page.locator(".account-tickets__results");
  await expect(results).toBeVisible();
  await page.getByRole("button", { name: "Lưới nhỏ", exact: true }).click();
  await expect(results).toHaveAttribute("data-size", "small");
  await page.getByRole("button", { name: "Danh sách", exact: true }).click();
  await expect(results).toHaveAttribute("data-layout", "list");
  await expect(page.locator(".account-tickets__photo").first()).toBeVisible();
  await page.reload();
  await expect(results).toHaveAttribute("data-size", "medium");
  await expect(page.locator(".account-tickets__photo").first()).toBeVisible();
  await expect(results).toHaveAttribute("data-layout", "list");
  await page.getByRole("button", { name: "Lưới lớn", exact: true }).click();
  await expect(results).toHaveAttribute("data-size", "large");
  await expect(page.locator(".account-tickets__photo").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lưới vừa", exact: true }),
  ).toHaveCount(0);
  await page.goto("/account/settings");
  await page.reload();
  await expect(offers).toBeChecked();
  await page.getByRole("button", { name: "Đặt về mặc định" }).click();
  await expect(offers).not.toBeChecked();
  await page.getByRole("button", { name: "Lưu tùy chọn" }).click();
  await page.screenshot({
    path: info.outputPath("customer-settings.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Tài khoản", exact: true }).click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/register");
  const email = `profile-${Date.now()}@example.invalid`;
  await page
    .getByLabel("Họ và tên", { exact: true })
    .fill("Khách tài khoản mới");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0987654321");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("DemoPass123");
  await page
    .getByLabel("Xác nhận mật khẩu", { exact: true })
    .fill("DemoPass123");
  await page.getByRole("checkbox", { name: /Tôi đồng ý/ }).check();
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await page.getByRole("link", { name: "Tiếp tục xác minh email" }).click();
  await page.getByLabel("Mã xác minh").fill("123456");
  await page.getByRole("button", { name: "Xác nhận email" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Email đã được xác minh",
  );
  await page.goto("/login");
  await page
    .getByLabel("Email hoặc số điện thoại", { exact: true })
    .fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("DemoPass123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/tickets$/);
  await page.goto("/account/profile");
  await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue(
    "Khách tài khoản mới",
  );
  await expect(page.getByLabel("Email đăng nhập")).toHaveValue(email);
  await expect(page.getByLabel("Số điện thoại liên hệ")).toHaveValue(
    "0987654321",
  );
  await expect(page.getByLabel("Tỉnh, thành đang sống")).toHaveValue("");
  await expect(page.locator(".customer-account__avatar")).toHaveAttribute(
    "src",
    defaultAvatarSrc ?? "",
  );
});
