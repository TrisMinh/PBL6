import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("trip coupons show conditions, copy code and preserve trip selection", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(
    "/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=1",
  );
  const card = page.locator(".trip-card").first();
  await expect(card).toContainText("4.8/5");
  await expect(card).toContainText("BLUE20");
  const offer = card.getByRole("button", { name: /Xem mã/ });
  await offer.click();
  const dialog = page.getByRole("dialog", { name: "Ưu đãi cho chuyến đi" });
  await expect(dialog).toContainText("Đơn tối thiểu 250.000");
  await expect(dialog).toContainText("Mã chưa được áp dụng");
  await dialog.getByRole("button", { name: "Sao chép mã" }).click();
  await expect(page.locator(".app-toast")).toContainText(
    "Đã sao chép mã BLUE20",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "BLUE20",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(offer).toBeFocused();
  await expect(card.getByRole("button", { name: "Chọn chuyến" })).toBeEnabled();
  for (const width of [1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    expect(await card.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      false,
    );
  }
});
