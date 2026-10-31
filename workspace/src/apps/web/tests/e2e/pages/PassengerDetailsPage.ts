import { expect, type Locator, type Page } from "@playwright/test";

import { SeatSelectionPage } from "./SeatSelectionPage";

export const TEST_CONTACT_EMAIL = "test+review@example.invalid";

export class PassengerDetailsPage {
  readonly confirm: Locator;
  constructor(private readonly page: Page) {
    this.confirm = page.getByRole("button", { name: "Xác nhận thông tin" });
  }
  async start(): Promise<void> {
    const seats = new SeatSelectionPage(this.page);
    await seats.start();
    await seats.select("A01");
    await seats.select("A02");
    await seats.continue();
    await expect(this.page.getByLabel("Email nhận vé")).toBeVisible();
  }
  async fill(
    names: Readonly<{ a01: string; a02: string }> = {
      a01: "Khách Một",
      a02: "Khách Hai",
    },
  ): Promise<void> {
    await this.page.getByLabel("Họ và tên (ghế A01)").fill(`  ${names.a01}  `);
    await this.page
      .getByLabel("Số điện thoại (ghế A01, không bắt buộc)")
      .fill("0912345678");
    await this.page.getByLabel("Họ và tên (ghế A02)").fill(names.a02);
    await this.page
      .getByLabel("Họ và tên người liên hệ")
      .fill("Khách Liên Hệ", { force: true });
    await this.page
      .getByLabel("Số điện thoại người liên hệ")
      .fill("0912345678", { force: true });
    await this.page.getByLabel("Email nhận vé").fill(TEST_CONTACT_EMAIL);
  }
  async expectInvalid(): Promise<void> {
    await this.confirm.click();
    await expect(this.page.getByLabel("Họ và tên (ghế A01)")).toBeFocused();
    await expect(this.page.getByLabel("Email nhận vé")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(this.page).toHaveURL(/\/passengers$/);
  }
  async save(): Promise<void> {
    await this.confirm.dblclick();
    await expect(this.page).toHaveURL(/\/booking\/[^/]+\/review$/);
    await expect(
      this.page.getByRole("heading", {
        name: "Kiểm tra trước khi thanh toán",
        exact: true,
      }),
    ).toBeVisible();
  }
  async expectRestored(): Promise<void> {
    await expect(this.page.getByLabel("Họ và tên (ghế A01)")).toHaveValue(
      "Khách Một",
    );
    await expect(this.page.getByLabel("Email nhận vé")).toHaveValue(
      TEST_CONTACT_EMAIL,
    );
  }
  async draft(): Promise<string | null> {
    return this.page.evaluate(() =>
      sessionStorage.getItem("blue-booking-draft"),
    );
  }
  async expectNoindex(): Promise<void> {
    await expect(this.page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  }
}
