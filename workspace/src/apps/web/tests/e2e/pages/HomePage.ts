import { expect, type Locator, type Page } from "@playwright/test";

export class HomePage {
  readonly heading: Locator;
  readonly message: Locator;
  readonly productTruths: Locator;
  readonly popularRoutes: Locator;
  readonly trustJourney: Locator;
  readonly supportBanner: Locator;
  readonly footer: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByTestId("home-heading");
    this.message = page.getByTestId("home-message");
    this.productTruths = page.getByRole("region", {
      name: "Cam kết dịch vụ",
    });
    this.popularRoutes = page.getByRole("heading", {
      name: "Tuyến đường phổ biến",
    });
    this.trustJourney = page.getByRole("heading", {
      name: "An tâm trên từng chặng đường",
    });
    this.supportBanner = page.getByRole("heading", {
      name: "Kế hoạch thay đổi? Bạn vẫn kiểm soát hành trình.",
    });
    this.footer = page.getByRole("contentinfo", { name: "Thông tin BLUE" });
  }

  async goto(): Promise<void> {
    await this.page.goto("/");
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveTitle("Đặt vé xe online nhanh chóng | BLUE");
    await expect(this.heading).toHaveText("Mỗi hành trình đều thật giản đơn.");
    await expect(this.message).toHaveText(
      "Chuyến ngon mình chọn, ghế ngon mình chốt",
    );
    await expect(this.productTruths).toBeVisible();
    await expect(this.popularRoutes).toBeVisible();
    await expect(this.trustJourney).toBeVisible();
    await expect(this.supportBanner).toBeVisible();
    await expect(this.footer).toBeVisible();
    await expect(
      this.page.getByRole("article", { name: "TP.HCM → Đà Lạt" }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("img", { name: "BLUE", exact: true }),
    ).toHaveCount(2);
  }

  async searchForTwoPassengers(): Promise<void> {
    await expect(
      this.page.getByRole("form", { name: "Tìm chuyến" }),
    ).toBeVisible();
    await this.page
      .getByLabel("Điểm đi", { exact: true })
      .selectOption("loc-hcm");
    await this.page
      .getByLabel("Điểm đến", { exact: true })
      .selectOption("loc-dalat");
    await this.page.getByLabel("Ngày đi", { exact: true }).fill("2099-01-01");
    await this.page.getByLabel("Hành khách", { exact: true }).selectOption("2");
    await this.page
      .getByRole("button", { name: "Tìm chuyến", exact: true })
      .click();
    await expect(this.page).toHaveURL(/\/trips\?.*passengerCount=2/);
  }
}
