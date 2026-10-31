import { expect, type Page } from "@playwright/test";

export class CancellationPage {
  constructor(private readonly page: Page) {}
  async openFromTicket(): Promise<void> {
    await this.page.getByRole("link", { name: "Hủy vé", exact: true }).click();
    await expect(
      this.page.getByRole("heading", { name: "Chọn vé cần hủy" }),
    ).toBeVisible();
  }
  async selectFirst(codes: readonly string[]): Promise<void> {
    const submit = this.page.getByRole("button", {
      name: "Xem phí và tiền hoàn",
    });
    await expect(submit).toBeDisabled();
    await this.page.getByRole("checkbox").first().check();
    await submit.click();
    const dialog = this.page.getByRole("dialog");
    await expect(dialog).toContainText(codes[0]);
    await expect(dialog).not.toContainText(codes[1]);
    await dialog.getByRole("button", { name: "Xác nhận hủy 1 vé" }).dblclick();
  }
  async expectProcessing(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: "Theo dõi hoàn tiền" }),
    ).toBeVisible();
    await expect(
      this.page.getByText("VNPay đang xử lý hoàn tiền"),
    ).toBeVisible();
  }
}
