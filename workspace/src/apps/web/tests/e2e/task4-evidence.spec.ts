import { expect, test, type Page } from "@playwright/test";

import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";
import { BookingReviewPage } from "./pages/BookingReviewPage";
import { PassengerDetailsPage } from "./pages/PassengerDetailsPage";

const EVIDENCE_DIR = "docs/quality/evidence/plan07-task4";

async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(async () => document.fonts.ready);
  await assertNoPageOverflow(page);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await page.evaluate(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({
    path: `${EVIDENCE_DIR}/${name}.png`,
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
}

async function capturePair(page: Page, name: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1040 });
  await capture(page, `final-${name}-w1440`);
  await page.setViewportSize({ width: 360, height: 900 });
  await capture(page, `final-${name}-w360`);
}

test.use({ viewport: { width: 1440, height: 1040 } });

test("captures Task4 final — passenger", async ({ page }) => {
  const passengers = new PassengerDetailsPage(page);
  await passengers.start();
  await passengers.fill();
  await expect(page.locator(".passenger-form")).toHaveCSS("width", "820px");
  await expect(page.locator(".booking-summary--passenger")).toHaveCSS(
    "width",
    "430px",
  );
  await capturePair(page, "passenger");
});

test("captures Task4 final — review", async ({ page }) => {
  const review = new BookingReviewPage(page);
  await review.start();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Kiểm tra trước khi thanh toán",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.locator(".booking-review")).toHaveCSS("width", "820px");
  await expect(page.locator(".booking-summary--review")).toHaveCSS(
    "width",
    "430px",
  );
  await capturePair(page, "review");
});
