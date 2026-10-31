import { expect, test } from "@playwright/test";

import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";
import { HomePage } from "./pages/HomePage";

test("HomePage on initial navigation shows the BLUE search hero", async ({
  page,
}) => {
  const homePage = new HomePage(page);

  await homePage.goto();
  await homePage.expectLoaded();
  await assertNoPageOverflow(page);
});

test("home search keeps invalid routes local and submits canonical params through SPA navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("form", { name: "Tìm chuyến" })).toBeVisible();
  await page.getByLabel("Điểm đi", { exact: true }).selectOption("loc-hcm");
  await page.getByLabel("Điểm đến", { exact: true }).selectOption("loc-hcm");
  await page.getByLabel("Ngày đi", { exact: true }).fill("2099-01-01");
  await page.getByRole("button", { name: "Tìm chuyến", exact: true }).click();
  await expect(
    page.getByText("Điểm đến phải khác điểm đi.", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL("/");
  await page.getByLabel("Điểm đến", { exact: true }).selectOption("loc-dalat");
  await page.getByLabel("Hành khách", { exact: true }).selectOption("2");
  await page.evaluate(() => {
    document.documentElement.dataset.navigationProbe = "retained";
  });
  await page.getByRole("button", { name: "Tìm chuyến", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    "/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-navigation-probe",
    "retained",
  );
});
