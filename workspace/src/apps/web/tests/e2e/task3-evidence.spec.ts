import { expect, test, type Page } from "@playwright/test";

import { SeatSelectionPage } from "./pages/SeatSelectionPage";
import { TripResultsPage } from "./pages/TripResultsPage";
import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";

const EVIDENCE_DIR = "docs/quality/evidence/plan07-task3";
const FIXED_NOW = new Date("2026-10-23T08:00:00+07:00");

test.use({ viewport: { width: 1440, height: 1080 } });

async function prepare(page: Page): Promise<void> {
  await page.clock.install({ time: FIXED_NOW });
  await page.clock.setFixedTime(FIXED_NOW);
}

async function capture(page: Page, name: string): Promise<void> {
  await expect(page.locator("main").first()).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.screenshot({
    path: `${EVIDENCE_DIR}/${name}.png`,
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
}

async function capturePair(page: Page, name: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await assertNoPageOverflow(page);
  await capture(page, `final-${name}-w1440`);
  await page.setViewportSize({ width: 360, height: 900 });
  await assertNoPageOverflow(page);
  await capture(page, `final-${name}-w360`);
}

async function openCard(
  page: Page,
  index: number,
  passengerCount = 2,
): Promise<SeatSelectionPage> {
  const results = new TripResultsPage(page);
  await results.goto(
    `originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=${passengerCount}`,
  );
  await results.expectCount(24);
  await results.cards
    .nth(index)
    .getByRole("button", { name: "Chọn chuyến" })
    .click();
  await expect(page).toHaveURL(/\/booking\/[^/]+\/seats$/);
  return new SeatSelectionPage(page);
}

test.beforeEach(async ({ page }) => prepare(page));

test("captures Task3 final — sleeper", async ({ page }) => {
  const seats = await openCard(page, 1);
  await seats.select("A01");
  await seats.select("A02");
  await expect(page.locator(".seat-map")).toHaveCSS("width", "800px");
  await expect(page.locator(".booking-summary")).toHaveCSS("width", "360px");
  await expect(page.locator(".seat svg")).toHaveCount(0);
  await expect(page.locator(".seat__pillow").first()).toHaveCSS(
    "width",
    "26px",
  );
  await expect(page.locator(".seat__pillow").first()).toHaveCSS(
    "height",
    "5px",
  );
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await capturePair(page, "sleeper");
});

test("captures Task3 final — cabin", async ({ page }) => {
  const seats = await openCard(page, 0);
  await seats.select("A03");
  await expect(page.locator(".seat svg")).toHaveCount(0);
  await expect(page.locator(".seat__pillow").first()).toHaveCSS(
    "width",
    "28px",
  );
  await expect(page.locator(".seat__pillow").first()).toHaveCSS(
    "height",
    "5px",
  );
  await capturePair(page, "cabin");
});

test("captures Task3 final — conflict", async ({ page }) => {
  const seats = await openCard(page, 1);
  await seats.select("A01");
  await seats.holdInCompetingSession("A02");
  await seats.selectConflicting("A02");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCSS("width", "580px");
  await expect(page.getByRole("dialog")).toHaveCSS("height", "400px");
  const conflictStatus = page.getByRole("listitem");
  await expect(conflictStatus).toContainText("Không còn khả dụng");
  await expect(conflictStatus).toContainText(
    "Vui lòng chọn vị trí ghế trống khác",
  );
  await capturePair(page, "conflict");
});

test("captures Task3 final — expired", async ({ page }) => {
  const seats = await openCard(page, 1);
  await seats.select("A01");
  await page.clock.setFixedTime(new Date(FIXED_NOW.getTime() + 600_001));
  await seats.expireCurrentHold();
  await expect(
    page.getByRole("dialog", { name: "Phiên giữ ghế đã hết hạn" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Phiên giữ ghế đã hết hạn" }),
  ).toHaveCSS("width", "580px");
  await expect(
    page.getByRole("dialog", { name: "Phiên giữ ghế đã hết hạn" }),
  ).toHaveCSS("height", "400px");
  const expiredDialog = page.getByRole("dialog", {
    name: "Phiên giữ ghế đã hết hạn",
  });
  await expect(expiredDialog).toContainText("PHIÊN GIỮ GHẾ");
  await expect(
    expiredDialog.getByRole("link", { name: "Quay lại danh sách" }),
  ).toHaveAttribute("href", /\/trips\?/);
  await expect(
    expiredDialog.getByRole("link", { name: "Kiểm tra lại chuyến" }),
  ).toHaveCSS("background-color", "rgb(31, 102, 229)");
  await capturePair(page, "expired");
});

test("captures Task3 final — six-seat limit", async ({ page }) => {
  const seats = await openCard(page, 1, 6);
  for (const code of ["A01", "A02", "A03", "A04", "A05", "A06"])
    await seats.select(code);
  await seats.seat("A07").click();
  await expect(
    page.getByRole("dialog", { name: "Bạn đã chọn đủ 6 chỗ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Bạn đã chọn đủ 6 chỗ" }),
  ).toHaveCSS("width", "580px");
  await expect(
    page.getByRole("dialog", { name: "Bạn đã chọn đủ 6 chỗ" }),
  ).toHaveCSS("height", "368px");
  await expect(page.locator(".seat-conflict__state-icon--limit")).toHaveCSS(
    "color",
    "rgb(200, 59, 77)",
  );
  await expect(page.locator(".seat-conflict__status-detail--limit")).toHaveCSS(
    "color",
    "rgb(31, 102, 229)",
  );
  await capturePair(page, "limit");
});
