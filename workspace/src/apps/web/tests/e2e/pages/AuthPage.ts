import { expect, type Page } from "@playwright/test";

export const CUSTOMER_EMAIL = "test+review@example.invalid";
export const ADMIN_EMAIL = "admin@blue.example.invalid";
export const DEMO_PASSWORD = "BlueDemo2026";

export class AuthPage {
  constructor(private readonly page: Page) {}

  async openLogin(path = "/login"): Promise<void> {
    await this.page.goto(path);
    await expect(
      this.page.getByRole("heading", {
        name: "Hành trình đang chờ bạn",
        exact: true,
      }),
    ).toBeVisible();
  }

  async login(email = CUSTOMER_EMAIL): Promise<void> {
    await this.page
      .getByLabel("Email hoặc số điện thoại", { exact: true })
      .fill(email);
    await this.page.getByLabel("Mật khẩu", { exact: true }).fill(DEMO_PASSWORD);
    await this.page
      .getByRole("button", { name: "Đăng nhập", exact: true })
      .dblclick();
  }

  async expectMockOnly(): Promise<void> {
    await expect(
      this.page.getByText(
        "Ứng dụng mô phỏng — không phải tài khoản hay đăng nhập thật.",
        { exact: true },
      ),
    ).toBeAttached();
  }

  async session(): Promise<string | null> {
    return this.page.evaluate(() =>
      sessionStorage.getItem("blue-mock-session"),
    );
  }
}
