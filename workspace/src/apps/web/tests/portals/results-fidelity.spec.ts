import { expect, test } from "@playwright/test";

test("Results 28:30 matches desktop inner layout, fonts and local assets", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "This correction targets the desktop design.",
  );
  await page.setViewportSize({ width: 1440, height: 1280 });
  await page.goto("/");
  const origin = page.getByLabel("Điểm đi", { exact: true });
  const destination = page.getByLabel("Điểm đến", { exact: true });
  await expect(origin.getByRole("option")).toHaveText([
    "Chọn điểm đi",
    "Hồ Chí Minh",
    "Đà Nẵng",
    "Lâm Đồng",
    "Hà Nội",
  ]);
  await expect(destination.getByRole("option")).toHaveText([
    "Chọn điểm đến",
    "Hồ Chí Minh",
    "Đà Nẵng",
    "Lâm Đồng",
    "Hà Nội",
  ]);
  await origin.selectOption({ label: "Hồ Chí Minh" });
  await destination.selectOption({ label: "Lâm Đồng" });
  await page.getByLabel("Ngày đi", { exact: true }).fill("2099-01-01");
  await page.getByLabel("Hành khách", { exact: true }).selectOption("2");
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByRole("form", { name: "Tìm chuyến" })
    .screenshot({ path: info.outputPath("province-search.png") });
  await page.getByRole("button", { name: "Tìm chuyến", exact: true }).click();
  await expect(page).toHaveURL(
    "/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2",
  );
  const cards = page.locator(".trip-card");
  await expect(cards).toHaveCount(6);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".trip-results__sort button")).toHaveCount(3);
  const filter = page.locator(".trip-filters__desktop");
  for (let index = 0; index < 6; index++) {
    const card = cards.nth(index);
    const bounds = await card.boundingBox();
    expect(bounds).not.toBeNull();
    const dimensions = await card.evaluate((el) => ({
      width: el.clientWidth,
      content: el.scrollWidth,
      height: el.clientHeight,
      contentHeight: el.scrollHeight,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.width);
    expect(dimensions.contentHeight).toBeLessThanOrEqual(dimensions.height);
    await expect(card.locator(".trip-card__select")).toBeVisible();
    await expect(card.locator(".trip-card__operator")).toHaveCSS(
      "font-family",
      '"Be Vietnam Pro", sans-serif',
    );
    await expect(card.locator(".trip-card__operator")).toHaveCSS(
      "font-weight",
      "600",
    );
    await expect(card.locator(".trip-card__fare")).toHaveCSS(
      "font-size",
      "19px",
    );
    const images = await card.locator("img").evaluateAll((nodes) =>
      nodes.map((img) => ({
        loaded:
          img instanceof HTMLImageElement &&
          img.complete &&
          img.naturalWidth > 0,
        source: img.getAttribute("src"),
      })),
    );
    expect(
      images.every((img) => img.loaded && !img.source?.includes("figma.com")),
    ).toBe(true);
  }
  await page.screenshot({
    path: info.outputPath("results-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Giá thấp nhất", exact: true })
    .click();
  await expect(cards.first().locator(".trip-card__fare")).toContainText(
    "250.000 đ",
  );
  await page.getByRole("button", { name: "Đặt lại", exact: true }).click();
  await expect(cards.first().locator(".trip-card__clock").first()).toHaveText(
    "07:00",
  );
  await page.getByLabel("Giờ xuất phát", { exact: true }).fill("08:00");

  await page.getByRole("button", { name: "Đặt lại", exact: true }).click();
  await filter
    .getByText("Nhà xe, điểm đón và điểm trả", { exact: true })
    .click();
  await filter
    .getByLabel("Điểm đón", { exact: true })
    .selectOption({ label: "Miền Đông mới" });
  await filter
    .getByLabel("Điểm trả", { exact: true })
    .selectOption({ label: "Bến xe Đà Lạt" });
  await filter.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("pickupStopId"))
    .toBe("Miền Đông mới");
  await expect(page.getByRole("heading", { name: /Chuyến xe/ })).toBeVisible();
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) {
    await expect(card.locator(".trip-card__terminal").first()).toHaveText(
      "Miền Đông mới",
    );
    await expect(card.locator(".trip-card__terminal").last()).toHaveText(
      "Bến xe Đà Lạt",
    );
  }
  await filter.screenshot({ path: info.outputPath("stop-filter.png") });
});
