import { expect, type Page, type Locator } from "@playwright/test";

export class ExplorePage {
  constructor(readonly page: Page) {}
  async goto(path = "/explore"): Promise<void> {
    await this.page.goto(path);
    if (path === "/") {
      await expect(
        this.page
          .getByRole("combobox", { name: "Điểm đi", exact: true })
          .getByRole("option"),
      ).toHaveCount(5);
    }
  }
  province(name: string): Locator {
    return this.page.getByRole("link", {
      name: new RegExp(`${name}.*Xem điểm đón, trả`),
    });
  }
  async ready(): Promise<void> {
    await expect(this.province("Lâm Đồng")).toBeVisible();
  }
  async search(value: string): Promise<void> {
    await this.page
      .getByRole("searchbox", { name: "Tìm tỉnh, thành" })
      .fill(value);
    await this.page
      .getByRole("button", { name: "Tìm kiếm", exact: true })
      .click();
  }
  async expectActive(label: string): Promise<void> {
    const mobile = (this.page.viewportSize()?.width ?? 1440) < 768;
    if (mobile)
      await this.page
        .getByRole("button", { name: "Mở menu", exact: true })
        .click();
    const nav = this.page.getByRole("navigation", {
      name: mobile ? "Điều hướng mobile" : "Điều hướng chính",
      exact: true,
    });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(
      nav.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    if (mobile) await this.page.keyboard.press("Escape");
  }
  async scenario(value: string): Promise<void> {
    await this.page.evaluate(
      (state) => sessionStorage.setItem("explore-e2e-scenario", state),
      value,
    );
  }
}
