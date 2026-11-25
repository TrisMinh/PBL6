import { expect, type Page } from "@playwright/test";

import { BookingReviewPage } from "./BookingReviewPage";

export class PaymentPage {
  constructor(private readonly page: Page) {}
  async start(names?: Readonly<{ a01: string; a02: string }>): Promise<void> {
    const review = new BookingReviewPage(this.page);
    await review.start(names);
    await review.continue();
    await expect(
      this.page.getByRole("tab", { name: "SePay QR", exact: true }),
    ).toBeEnabled();
  }
  async pay(label = "Tiếp tục đến VNPay"): Promise<void> {
    const demo = this.page.getByText(
      "Bản trải nghiệm · Mô phỏng kết quả ngân hàng",
      { exact: true },
    );
    await demo.click();
    const outcome = label.includes("thất bại")
      ? "failed"
      : label.includes("hủy")
        ? "cancelled"
        : label.includes("chờ")
          ? "pending"
          : "success";
    await this.page
      .locator(".mock-gateway__outcome select")
      .selectOption(outcome);
    await this.page
      .getByRole("button", {
        name: "Xác nhận thanh toán mô phỏng",
        exact: true,
      })
      .click();
    await expect(this.page).toHaveURL(
      /\/payment\/sepay\/return\?transactionId=/,
    );
  }
  async expectState(heading: string): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(this.page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  }
  async ticketCodes(): Promise<string[]> {
    return this.page
      .getByRole("link", { name: /Xem vé BLUE-/ })
      .allTextContents();
  }
  async draft(): Promise<string | null> {
    return this.page.evaluate(() =>
      sessionStorage.getItem("blue-booking-draft"),
    );
  }
  async retry(): Promise<void> {
    await this.page
      .getByRole("link", { name: "Chọn phương thức khác", exact: true })
      .click();
    await expect(
      this.page.getByRole("tab", { name: "SePay QR", exact: true }),
    ).toBeEnabled();
  }
  async recheck(): Promise<void> {
    await this.page
      .getByRole("button", { name: "Kiểm tra giao dịch", exact: true })
      .click();
  }
  async expectNoTickets(): Promise<void> {
    await expect(
      this.page.getByRole("link", { name: /Xem vé BLUE-/ }),
    ).toHaveCount(0);
  }
  async invalid(): Promise<void> {
    await this.page.goto(
      "/payment/vnpay/return?transactionId=missing&resultId=missing",
    );
    await this.expectState("Không tìm thấy giao dịch");
  }
}
