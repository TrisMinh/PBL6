import { expect, test, type Locator, type Page } from "@playwright/test";

import { BookingReviewPage } from "./pages/BookingReviewPage";
import { HomePage } from "./pages/HomePage";
import { PassengerDetailsPage } from "./pages/PassengerDetailsPage";
import { PaymentPage } from "./pages/PaymentPage";
import { SeatSelectionPage } from "./pages/SeatSelectionPage";
import { TicketPage } from "./pages/TicketPage";
import { TripResultsPage } from "./pages/TripResultsPage";

async function expectPageFits(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

async function expectAccessibleAction(action: Locator): Promise<void> {
  const box = await action.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  await action.focus();
  await expect(action).toBeFocused();
}

test("@critical guest completes search through VNPay success and opens the issued ticket", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const runtimeErrors: string[] = [];
  const requestUrls: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("request", (request) => requestUrls.push(request.url()));
  const home = new HomePage(page);
  await home.goto();
  const searchAction = page.getByRole("button", {
    name: "Tìm chuyến",
    exact: true,
  });
  await expectAccessibleAction(searchAction);
  const transitionDuration = await searchAction.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).transitionDuration),
  );
  expect(transitionDuration).toBeLessThanOrEqual(0.00001);
  await expectPageFits(page);
  await home.searchForTwoPassengers();

  const results = new TripResultsPage(page);
  await results.expectCount(24);
  await expectAccessibleAction(
    results.cards.first().getByRole("button", { name: "Chọn chuyến" }),
  );
  await expectPageFits(page);
  await results.selectFirst();
  await results.expectBookingStarted();

  const seats = new SeatSelectionPage(page);
  await seats.select("A01");
  await seats.select("A02");
  await expectAccessibleAction(seats.continueButton);
  await expectPageFits(page);
  await seats.continue();

  const passengers = new PassengerDetailsPage(page);
  await passengers.fill();
  await expectAccessibleAction(passengers.confirm);
  await expectPageFits(page);
  await passengers.save();

  const review = new BookingReviewPage(page);
  await expectAccessibleAction(review.continueButton);
  await expectPageFits(page);
  await review.continue();

  const payment = new PaymentPage(page);
  await expectAccessibleAction(
    page.getByRole("button", { name: "Tiếp tục đến VNPay", exact: true }),
  );
  await expectPageFits(page);
  await payment.pay();
  await payment.expectState("Thanh toán thành công");
  await expectPageFits(page);
  expect(await payment.ticketCodes()).toHaveLength(2);

  const tickets = new TicketPage(page);
  const bookingCode = await page
    .getByRole("article", { name: "Kết quả giao dịch" })
    .getByText(/^BLUE-[A-Z0-9-]+$/)
    .textContent();
  expect(bookingCode).toBeTruthy();
  await tickets.requireLookup();
  await expectPageFits(page);
  await tickets.lookup(bookingCode ?? "");
  await tickets.expectIssued();
  await expectPageFits(page);
  expect(runtimeErrors).toEqual([]);
  expect(
    requestUrls.every(
      (url) =>
        !url.includes("test%2Breview") &&
        !url.includes("0912345678") &&
        !url.includes("verificationValue") &&
        !url.includes("token="),
    ),
  ).toBe(true);
});

test("@critical seat conflict rolls the optimistic selection back atomically", async ({
  page,
}) => {
  const seats = new SeatSelectionPage(page);
  await seats.start();
  await seats.select("A01");
  await seats.holdInCompetingSession("A02");
  await seats.selectConflicting("A02");
  await seats.expectConflictRollback("A02");
});

test("@critical hold expiry uses the original deadline and clears the stale draft", async ({
  page,
}) => {
  await page.clock.install();
  const seats = new SeatSelectionPage(page);
  await seats.start();
  await seats.select("A01");
  await seats.expireCurrentHold();
  await seats.recoverExpiredHold();
});
