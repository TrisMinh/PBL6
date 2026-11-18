/* global console, sessionStorage, URL, document, window */
import { chromium, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { chooseAdminFilter } from "./admin-filter-select.mjs";
const base = "http://localhost:5175";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
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
  async function api(endpoint) {
    const response = await page.request.get(base + endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
    return response.json();
  }
  const organizations = await api("/api/v1/admin/organizations");
  expect(organizations.length).toBeGreaterThanOrEqual(8);
  const target = organizations.find((org) => org.code === "HAI-VAN-TRAVEL");
  expect(target).toBeTruthy();
  for (const resource of ["staff", "bookings", "payments", "refunds"]) {
    await page.goto(base + `/admin/${resource}?page=2&future=keep`, {
      waitUntil: "networkidle",
    });
    await expect(
      page
        .locator(
          "tbody tr, .transaction-state--empty, .admin-list-state--empty",
        )
        .first(),
    ).toBeVisible();
    const control = page.getByRole("combobox", { name: "Nhà xe", exact: true });
    const initialURL = page.url();
    expect(await control.evaluate((element) => element.tagName)).toBe("BUTTON");
    await control.click();
    const search = page.getByRole("textbox", {
      name: "Tìm nhà xe",
      exact: true,
    });
    await expect(search).toBeFocused();
    await search.fill("no-such-operator-19283");
    await expect(
      page.getByRole("status").filter({ hasText: "Không tìm thấy kết quả" }),
    ).toBeVisible();
    expect(page.url()).toBe(initialURL);
    await search.fill("hai van");
    await expect(
      page.getByRole("option", { name: target.name, exact: true }),
    ).toBeVisible();
    await search.fill(target.code);
    await expect(
      page.getByRole("option", { name: target.name, exact: true }),
    ).toBeVisible();
    if (resource === "payments") await search.press("Enter");
    else
      await page
        .getByRole("option", { name: target.name, exact: true })
        .click();
    await expect(control).toContainText(target.name);
    expect(new URL(page.url()).searchParams.get("organizationId")).toBe(
      target.id,
    );
    expect(new URL(page.url()).searchParams.has("page")).toBe(false);
    expect(new URL(page.url()).searchParams.get("future")).toBe("keep");
    expect(new URL(page.url()).searchParams.has("query")).toBe(false);
    await expect(
      page
        .locator(
          "tbody tr, .transaction-state--empty, .admin-list-state--empty",
        )
        .first(),
    ).toBeVisible();
    expect(
      await page
        .getByRole("combobox", { name: "Trạng thái", exact: true })
        .evaluate((element) => element.tagName),
    ).toBe("SELECT");
    await page.reload({ waitUntil: "networkidle" });
    await expect(control).toContainText(target.name);
    await control.click();
    await expect(search).toHaveValue("");
    await search.fill("abc");
    await search.press("Escape");
    await expect(control).toContainText(target.name);
    await expect(control).toBeFocused();
    await chooseAdminFilter(page, "Nhà xe", "");
    expect(new URL(page.url()).searchParams.has("organizationId")).toBe(false);
    console.log(
      `PASS: ${resource} searchable organization filter: accent-free search, empty results, selection, page reset, reload, Escape and clear`,
    );
  }
  await page.goto(base + "/admin/bookings", { waitUntil: "networkidle" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("combobox", { name: "Nhà xe", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Tìm nhà xe", exact: true })
      .fill("hai van");
    await expect(
      page.getByRole("option", { name: target.name, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: path.join(os.tmpdir(), `pbl6-search-filter-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    console.log(
      `PASS: searchable dropdown at ${width}px without horizontal overflow`,
    );
  }
  expect(errors).toEqual([]);
  await page.locator(".admin-layout__account").click();
  await page.locator(".admin-layout__account-actions button").click();
  await page.waitForURL("**/login");
} finally {
  await browser.close();
}
