import { expect, type Page } from "@playwright/test";

import { PaymentPage } from "./PaymentPage";
import { TEST_CONTACT_EMAIL } from "./PassengerDetailsPage";

export class TicketPage {
  constructor(private readonly page: Page) {}
  async issued(
    names?: Readonly<{ a01: string; a02: string }>,
  ): Promise<string> {
    const payment = new PaymentPage(this.page);
    await payment.start(names);
    await payment.pay();
    await payment.expectState("Thanh toán thành công");
    const code = await this.page
      .getByRole("article", { name: "Kết quả giao dịch" })
      .getByText(/^BLUE-[A-Z0-9-]+$/)
      .textContent();
    expect(code).toBeTruthy();
    return code ?? "";
  }
  async requireLookup(): Promise<void> {
    await this.page
      .getByRole("link", { name: /Xem vé BLUE-/ })
      .first()
      .click();
    await expect(
      this.page.getByRole("heading", {
        name: "Cần xác thực để xem vé",
        exact: true,
      }),
    ).toBeVisible();
    await this.page
      .getByRole("main")
      .getByRole("link", { name: "Tra cứu vé", exact: true })
      .click();
    await expect(this.page).toHaveURL(/\/tickets\/lookup$/);
  }
  async lookup(bookingCode: string, proof = TEST_CONTACT_EMAIL): Promise<void> {
    await this.page.getByLabel("Mã đặt vé", { exact: true }).fill(bookingCode);
    await this.page
      .getByLabel("Email hoặc số điện thoại đã đặt vé", { exact: true })
      .fill(proof);
    await this.page
      .getByRole("button", { name: "Tra cứu vé", exact: true })
      .dblclick();
  }
  async expectIssued(name = "Khách Một", seat = "A01"): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: "Vé điện tử", exact: true }),
    ).toBeVisible();
    await expect(this.page.getByText(name, { exact: true })).toBeVisible();
    await expect(this.page.getByText(seat, { exact: true })).toBeVisible();
    await expect(this.page.getByText(/không dùng để quét/)).toBeVisible();
    await expect(this.page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  }
  async otherTicket(): Promise<void> {
    await this.page.getByRole("link", { name: /Xem vé BLUE-/ }).click();
  }
  async expectNotFound(): Promise<void> {
    await expect(this.page.getByRole("alert")).toContainText(
      "Không tìm thấy vé",
    );
  }
  async expectExpired(): Promise<void> {
    await expect(
      this.page.getByRole("heading", {
        name: "Cần xác thực để xem vé",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      this.page
        .getByRole("main")
        .getByRole("link", { name: "Tra cứu vé", exact: true }),
    ).toHaveAttribute("href", "/tickets/lookup");
    await expect(this.page.getByText("Khách Một", { exact: true })).toHaveCount(
      0,
    );
  }
  async access(): Promise<string | null> {
    return this.page.evaluate(() =>
      sessionStorage.getItem("blue-ticket-access"),
    );
  }
}
