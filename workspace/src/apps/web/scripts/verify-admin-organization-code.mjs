/* global console, sessionStorage */
import { chromium, expect } from "@playwright/test";
const base = "http://localhost:5175";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  await page.locator("input[type=email]").fill("admin.seed@example.test");
  await page
    .locator('input[autocomplete="current-password"]')
    .fill("AdminPass1234");
  await page.locator("button[type=submit]").click();
  await page.waitForURL("**/admin/organizations");
  const token = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("blue-api-session")).accessToken,
  );
  const response = await page.request.get(
    base + "/api/v1/admin/organizations",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(response.status()).toBe(200);
  const organizations = await response.json();
  const org =
    organizations.find((item) => item.code === "AN-NHIEN-TRAVEL") ??
    organizations.find((item) => item.code && item.code !== item.id);
  expect(org).toBeTruthy();
  await page.locator(".admin-filters input").fill(org.code);
  await page.locator(".admin-filters input").press("Enter");
  const row = page
    .locator("tbody tr")
    .filter({ has: page.locator(`a[href="/admin/organizations/${org.id}"]`) });
  await expect(
    row.locator("td").nth(1).locator(".admin-data-table__value"),
  ).toHaveText(org.code);
  await expect(row).not.toContainText(org.id);
  console.log(
    "PASS: organization code displayed and searchable; database ID hidden in row",
  );
  await row.locator("a").first().click();
  await expect(page).toHaveURL(base + "/admin/organizations/" + org.id);
  const profile = await page.request.get(
    base + `/api/v1/admin/organizations/${org.id}/profile`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(profile.status()).toBe(200);
  expect((await profile.json()).code).toBe(org.code);
  await expect(
    page.locator(".organization-page__detail-card dd").first(),
  ).toHaveText(org.code);
  await expect(page.locator(".organization-page__meta")).toContainText(
    org.code,
  );
  await expect(page.locator(".organization-page__meta")).not.toContainText(
    org.id,
  );
  console.log(
    "PASS: profile API and detail use business code; UUID still routes to correct organization",
  );
  await page.locator(".admin-layout__account").click();
  await page.locator(".admin-layout__account-actions button").click();
  await page.waitForURL("**/login");
} finally {
  await browser.close();
}
