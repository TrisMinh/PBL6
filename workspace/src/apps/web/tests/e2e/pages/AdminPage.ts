import { expect, type Page } from "@playwright/test";

import { ADMIN_EMAIL, AuthPage } from "./AuthPage";

export class AdminPage {
  constructor(private readonly page: Page) {}

  async login(path = "/admin/organizations"): Promise<void> {
    await this.page.goto(path, { waitUntil: "domcontentloaded" });
    const auth = new AuthPage(this.page);
    await auth.login(ADMIN_EMAIL);
    await expect(this.page).toHaveURL(
      new RegExp(`${path.replace("?", "\\?")}$`),
    );
  }

  async navigate(label: string, path: string): Promise<void> {
    const isMobile = (this.page.viewportSize()?.width ?? 1440) < 1024;
    const mobileMenu = this.page.getByRole("button", {
      name: "Mở menu quản trị",
    });
    if (isMobile) {
      await expect(mobileMenu).toBeVisible();
      const menuBox = await mobileMenu.boundingBox();
      expect(menuBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(44);
      await mobileMenu.click();
      await this.page
        .getByRole("navigation", { name: "Điều hướng quản trị mobile" })
        .getByRole("link", { name: label, exact: true })
        .click();
    } else {
      const navigation = this.page.getByRole("navigation", {
        name: "Điều hướng quản trị",
      });
      await expect(navigation).toBeVisible();
      await navigation.getByRole("link", { name: label, exact: true }).click();
    }
    await expect(this.page).toHaveURL(new RegExp(`${path}$`));
  }

  async expectResponsiveTable(caption: string): Promise<void> {
    const table = this.page.getByRole("table", { name: caption });
    await expect(table).toBeVisible();
    const isMobile = (this.page.viewportSize()?.width ?? 1440) < 768;
    const headPosition = await table
      .locator("thead")
      .evaluate((element) => getComputedStyle(element).position);
    const mobileLabelDisplay = await table
      .locator("tbody tr")
      .first()
      .locator("td")
      .first()
      .locator("span[aria-hidden='true']")
      .evaluate((element) => getComputedStyle(element).display);
    expect(headPosition).toBe(isMobile ? "absolute" : "static");
    expect(mobileLabelDisplay === "none").toBe(!isMobile);
  }

  async expectViewportQuality(): Promise<void> {
    const metrics = await this.page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    }));
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.reducedMotion).toBe(true);
  }

  async expectMinimumTarget(name: string): Promise<void> {
    const target = this.page.getByRole("button", { name }).first();
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
}
