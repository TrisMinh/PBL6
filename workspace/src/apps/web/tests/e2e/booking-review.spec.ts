import { expect, test } from "@playwright/test";

import { BookingReviewPage } from "./pages/BookingReviewPage";

test("guest review creates one booking and refresh/back reuse its original attempt and hold", async ({
  page,
}) => {
  const review = new BookingReviewPage(page);
  let requests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/v1/bookings")
    )
      requests++;
  });
  await review.start();
  const before = JSON.parse((await review.draft()) ?? "null").state.draft;
  await review.continue();
  expect(requests).toBe(1);
  const saved = await review.draft();
  const draft = JSON.parse(saved ?? "null").state.draft;
  expect(draft.expiresAt).toBe(before.expiresAt);
  expect(draft.bookingAttemptKey).toBeTruthy();
  expect(draft.bookingId).toBeTruthy();
  expect(new URL(page.url()).pathname).toBe(
    `/payment/${draft.bookingId}/vnpay`,
  );
  expect(new URL(page.url()).search).toBe("");
  await page.goBack();
  await review.expectLocked();
  await review.expectNoindex();
  await page.reload();
  await review.expectLocked();
  expect(await review.draft()).toBe(saved);
  await review.continue();
  expect(requests).toBe(2);
  expect(await review.draft()).toBe(saved);
});
