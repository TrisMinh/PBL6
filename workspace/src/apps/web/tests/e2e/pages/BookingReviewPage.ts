import { expect, type Page, type Locator } from "@playwright/test";

import { PassengerDetailsPage } from "./PassengerDetailsPage";

export class BookingReviewPage {
  readonly continueButton: Locator;
  constructor(private readonly page: Page) {
    this.continueButton = page.getByRole("button", {
      name: /^Tiếp tục thanh toán/,
    });
  }
  async start(names?: Readonly<{ a01: string; a02: string }>): Promise<void> {
    const passengers = new PassengerDetailsPage(this.page);
    await passengers.start();
    await passengers.fill(names);
    await passengers.save();
    await expect(this.continueButton).toBeEnabled();
  }
  async draft(): Promise<string | null> {
    return this.page.evaluate(() =>
      sessionStorage.getItem("blue-booking-draft"),
    );
  }
  async continue(): Promise<void> {
    await this.continueButton.dblclick();
    await expect(this.page).toHaveURL(/\/payment\/[^/]+\/vnpay$/);
    await expect(
      this.page.getByRole("heading", {
        name: "Thanh toán đơn đặt vé",
        exact: true,
      }),
    ).toBeVisible();
  }
  async expectLocked(): Promise<void> {
    await expect(this.page.getByRole("status")).toContainText(
      "Đặt vé đã được xác nhận",
    );
    await expect(
      this.page.getByRole("link", { name: /Chỉnh sửa/ }),
    ).toHaveCount(0);
    await expect(this.continueButton).toBeEnabled();
  }
  async expectNoindex(): Promise<void> {
    await expect(this.page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  }
}
