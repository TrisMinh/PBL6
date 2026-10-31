import { expect, test } from "@playwright/test";

import { CancellationPage } from "./pages/CancellationPage";
import { TicketPage } from "./pages/TicketPage";

test("@critical guest cancels one ticket with scoped access and refresh keeps split status", async ({
  page,
}) => {
  let cancellationPosts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/cancellations")
    ) {
      cancellationPosts++;
      expect(request.headers()["idempotency-key"]).toBeTruthy();
      expect(request.headers()["x-ticket-lookup-token"]).toBeTruthy();
    }
  });
  const tickets = new TicketPage(page),
    bookingCode = await tickets.issued();
  await tickets.requireLookup();
  await tickets.lookup(bookingCode);
  await tickets.expectIssued();
  const access = JSON.parse((await tickets.access()) ?? "null");
  const cancellation = new CancellationPage(page);
  await cancellation.openFromTicket();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  const firstChoice = page.getByRole("checkbox").first();
  await firstChoice.focus();
  await page.keyboard.press("Tab");
  const secondChoice = page.getByRole("checkbox").nth(1);
  await expect(secondChoice).toBeFocused();
  const focusedChoice = await secondChoice
    .locator("..")
    .evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      outline: getComputedStyle(element).outlineStyle,
    }));
  expect(focusedChoice.height).toBeGreaterThanOrEqual(68);
  expect(focusedChoice.outline).toBe("solid");
  await cancellation.selectFirst(access.ticketCodes);
  await cancellation.expectProcessing();
  expect(cancellationPosts).toBe(1);
  await page.goto(`/tickets/${access.ticketCodes[0]}`);
  await expect(page.getByRole("article", { name: "Vé đã hủy" })).toBeVisible();
  await expect(
    page.getByText("Vé đã hủy — mã vé không còn hiệu lực"),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("article", { name: "Vé đã hủy" })).toBeVisible();
  await page.goto(`/tickets/${access.ticketCodes[1]}`);
  await expect(
    page.getByRole("article", { name: "Vé đã phát hành" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
