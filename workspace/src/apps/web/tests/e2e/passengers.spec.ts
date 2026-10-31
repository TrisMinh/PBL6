import { expect, test } from "@playwright/test";

import { PassengerDetailsPage } from "./pages/PassengerDetailsPage";

test("guest passenger validation saves once and restores canonical values on back and refresh", async ({
  page,
}) => {
  const details = new PassengerDetailsPage(page);
  let requests = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().endsWith("/passengers"))
      requests++;
  });
  await details.start();
  await details.expectInvalid();
  expect(requests).toBe(0);
  await details.fill();
  const before = JSON.parse((await details.draft()) ?? "null").state.draft;
  await details.save();
  expect(requests).toBe(1);
  expect(new URL(page.url()).search).toBe("");
  const saved = await details.draft();
  expect(JSON.parse(saved ?? "null").state.draft.expiresAt).toBe(
    before.expiresAt,
  );
  await page.goBack();
  await details.expectRestored();
  await page.reload();
  await details.expectRestored();
  expect(await details.draft()).toBe(saved);
  await details.expectNoindex();
});
