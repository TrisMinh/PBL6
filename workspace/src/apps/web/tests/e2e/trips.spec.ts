import { expect, test } from "@playwright/test";

import { TripResultsPage, VALID_TRIP_SEARCH } from "./pages/TripResultsPage";

test.describe("Trip discovery — FR-001/FR-002", () => {
  test("results preserve filter URL then create one session and open guarded seats", async ({
    page,
  }) => {
    const results = new TripResultsPage(page);
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await results.goto();
    await expect(page).toHaveTitle("Tìm chuyến | BLUE");
    await results.expectCount(24);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Chuyến xe TP. Hồ Chí Minh → Đà Lạt",
    );
    await results.setFilters("price-asc", "cabin-22");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("sort"))
      .toBe("price-asc");
    await results.expectCount(24);
    await results.expectResultCount(2);
    await results.expectPageSize(2);
    await results.resetFilters();
    await expect(page).toHaveURL(`/trips?${VALID_TRIP_SEARCH}`);
    await results.expectCount(24);
    expect(posts).toEqual([]);
    await results.selectFirst();
    await results.expectBookingStarted();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toContain("/api/v1/booking-sessions");
    const before = await page.evaluate(() =>
      sessionStorage.getItem("blue-booking-draft"),
    );
    await page.reload();
    await results.expectBookingStarted();
    expect(
      await page.evaluate(() => sessionStorage.getItem("blue-booking-draft")),
    ).toBe(before);
    expect(posts).toHaveLength(1);
  });

  test("invalid and empty searches expose clear recovery actions", async ({
    page,
  }) => {
    const results = new TripResultsPage(page);
    await results.goto("passengerCount=7");
    await expect(
      page.getByRole("heading", { name: "Thông tin tìm kiếm chưa hợp lệ" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Tìm lại chuyến" }),
    ).toHaveAttribute("href", "/");
    await results.goto(VALID_TRIP_SEARCH.replace("2099-01-01", "2099-02-01"));
    await expect(
      page.getByRole("heading", { name: "Không tìm thấy chuyến phù hợp" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sửa tìm kiếm" }),
    ).toHaveAttribute("href", "/");
    await expect(page.getByRole("button", { name: "Thử lại" })).toHaveCount(0);
  });

  test("pagination exposes pages two through four with unique result records", async ({
    page,
  }) => {
    const results = new TripResultsPage(page);
    await results.goto();
    await results.expectCount(24);
    const seen = new Set<string>();
    let previousFirstId: string | null = null;
    for (let current = 1; current <= 4; current++) {
      await expect(
        page.locator('button[aria-current="page"]', {
          hasText: String(current),
        }),
      ).toBeVisible();
      if (previousFirstId)
        await expect(results.cards.first()).not.toHaveAttribute(
          "id",
          previousFirstId,
        );
      previousFirstId = await results.cards.first().getAttribute("id");
      for (const article of await results.cards.all()) {
        const id = await article.getAttribute("id");
        expect(id).toMatch(/^trip-/);
        expect(seen.has(id ?? "")).toBe(false);
        seen.add(id ?? "");
      }
      if (current < 4)
        await page.getByRole("button", { name: "Trang sau" }).click();
    }
    expect(seen.size).toBe(24);
  });
});
