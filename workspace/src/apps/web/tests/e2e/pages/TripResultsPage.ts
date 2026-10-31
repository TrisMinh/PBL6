import { expect, type Locator, type Page } from "@playwright/test";

export const VALID_TRIP_SEARCH =
  "originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2";

export class TripResultsPage {
  readonly cards: Locator;

  constructor(private readonly page: Page) {
    this.cards = page.getByRole("article");
  }

  async goto(query = VALID_TRIP_SEARCH): Promise<void> {
    await this.page.goto(`/trips?${query}`);
  }

  async expectCount(count: number): Promise<void> {
    await expect(
      this.page.getByText(`${count} chuyến phù hợp`, { exact: true }),
    ).toBeVisible();
  }

  async expectResultCount(count: number): Promise<void> {
    await expect(
      this.page.getByText(`${count} kết quả`, { exact: true }),
    ).toBeVisible();
  }

  private isMobile(): boolean {
    return (this.page.viewportSize()?.width ?? 0) < 768;
  }

  private async controls(): Promise<Locator> {
    if (!this.isMobile())
      return this.page.getByRole("region", { name: "Bộ lọc chuyến" });
    await this.page
      .getByRole("button", { name: "Bộ lọc và sắp xếp", exact: true })
      .click();
    return this.page.getByRole("dialog", { name: "Bộ lọc và sắp xếp" });
  }

  async setFilters(sort: string, vehicle: string): Promise<void> {
    const controls = await this.controls();
    if (this.isMobile()) {
      await controls.getByLabel("Sắp xếp", { exact: true }).selectOption(sort);
    } else {
      const sortLabels: Record<string, string> = {
        departure: "Khởi hành sớm",
        "price-asc": "Giá thấp nhất",
        "price-desc": "Giá cao nhất",
      };
      const sortButton = this.page.getByRole("button", {
        name: sortLabels[sort] ?? sort,
        exact: true,
      });
      await sortButton.click();
      await expect(sortButton).toHaveAttribute("aria-pressed", "true");
    }
    await expect
      .poll(() => new URL(this.page.url()).searchParams.get("sort"))
      .toBe(sort);
    await controls.getByLabel("Loại xe", { exact: true }).selectOption(vehicle);
    await controls
      .getByRole("button", { name: "Áp dụng bộ lọc", exact: true })
      .click();
    if (this.isMobile()) await this.page.keyboard.press("Escape");
  }

  async selectFirst(): Promise<void> {
    await this.cards
      .first()
      .getByRole("button", { name: "Chọn chuyến" })
      .click();
  }

  async expectPageSize(count: number): Promise<void> {
    await expect(this.cards).toHaveCount(count);
  }

  async expectBookingStarted(): Promise<void> {
    await expect(this.page).toHaveURL(/\/booking\/[^/]+\/seats$/);
    await expect(
      this.page.getByRole("heading", {
        name: "Chọn cabin của bạn",
        exact: true,
      }),
    ).toBeVisible();
    await expect(this.page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  }

  async resetFilters(): Promise<void> {
    const controls = await this.controls();
    await controls.getByRole("button", { name: "Đặt lại" }).click();
    if (this.isMobile()) await this.page.keyboard.press("Escape");
  }
}
