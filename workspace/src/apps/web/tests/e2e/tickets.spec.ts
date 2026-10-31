import { expect, test } from "@playwright/test";

import { TicketPage } from "./pages/TicketPage";

test.describe("Guest ticket lookup — FR-015/FR-021/FR-023", () => {
  test("requires proof after payment then refreshes exact scoped detail without URL/response/log proof", async ({
    page,
  }) => {
    const errors: string[] = [],
      urls: string[] = [],
      privateBodies: string[] = [];
    let requests = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      urls.push(request.url());
      if (
        request.method() === "POST" &&
        request.url().endsWith("/tickets/lookup")
      )
        requests++;
    });
    page.on("response", (response) => {
      if (response.url().match(/\/api\/v1\/tickets\/BLUE-/))
        void response.text().then((body) => {
          if (
            body.includes("guestVerification") ||
            body.includes("test+review")
          )
            privateBodies.push(body);
        });
    });
    const tickets = new TicketPage(page),
      booking = await tickets.issued();
    await tickets.requireLookup();
    await tickets.lookup(booking);
    await tickets.expectIssued();
    const first = await tickets.access();
    expect(first).not.toContain("test+review");
    expect(first).not.toContain("verificationValue");
    expect(requests).toBe(1);
    expect(page.url()).toMatch(/\/tickets\/BLUE-[A-Z0-9-]+$/);
    await page.reload();
    await tickets.expectIssued();
    expect(await tickets.access()).toBe(first);
    await tickets.otherTicket();
    await tickets.expectIssued("Khách Hai", "A02");
    expect(
      urls.every(
        (url) =>
          !url.includes("verificationValue") &&
          !url.includes("test%2Breview") &&
          !url.includes("token="),
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(privateBodies).toEqual([]);
  });
  test("generic not-found allows corrected contact proof without persisting the failed value", async ({
    page,
  }) => {
    const tickets = new TicketPage(page),
      booking = await tickets.issued();
    await tickets.requireLookup();
    await tickets.lookup(booking, "test+wrong@example.invalid");
    await tickets.expectNotFound();
    expect(page.url()).toMatch(/\/tickets\/lookup$/);
    expect(await tickets.access()).toBeNull();
    await tickets.lookup(booking, "+84912345678");
    await tickets.expectIssued();
  });
  test("expiry removes access and passenger UI and refresh remains fail-closed", async ({
    page,
  }) => {
    await page.clock.install();
    const tickets = new TicketPage(page),
      booking = await tickets.issued();
    await tickets.requireLookup();
    await tickets.lookup(booking);
    await tickets.expectIssued();
    await page.clock.fastForward(900001);
    await tickets.expectExpired();
    expect(await tickets.access()).toBeNull();
    await page.reload();
    await tickets.expectExpired();
  });
});
