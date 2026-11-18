/* global console, process, sessionStorage, URL */
// Read-only live checks plus browser-local fault injection. Never opens a visible browser.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const base = "http://localhost:5175";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(20000);
const errors = [];
const checks = [];
page.on("pageerror", (error) => errors.push(error.message));
const passed = (name) => {
  checks.push(name);
  console.log("PASS:", name);
};
const go = (route) => page.goto(base + route, { waitUntil: "networkidle" });
try {
  await go("/admin/bookings");
  await page.waitForURL("**/login**");
  passed("Anonymous direct admin URL redirects to login");
  await page
    .locator("input[type=email]")
    .fill(process.env.ADMIN_TEST_EMAIL || "admin.seed@example.test");
  await page
    .locator('input[autocomplete="current-password"]')
    .fill(process.env.ADMIN_TEST_PASSWORD || "AdminPass1234");
  await page.locator("button[type=submit]").click();
  await page.waitForURL("**/admin/**");
  const token = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("blue-api-session")).accessToken,
  );
  async function api(route, authorized = true) {
    const response = await page.request.get(base + route, {
      headers: authorized ? { Authorization: `Bearer ${token}` } : {},
    });
    expect(response.ok(), `${route}: ${response.status()}`).toBeTruthy();
    return response.json();
  }
  async function all(resource) {
    const rows = [];
    for (let index = 0; ; index++) {
      const result = await api(
        `/api/v1/admin/${resource}?page=${index}&size=100`,
      );
      if (Array.isArray(result)) return result;
      rows.push(...result.items);
      if (index + 1 >= result.totalPages) return rows;
    }
  }
  const resources = [
    "organizations",
    "staff",
    "bookings",
    "payments",
    "refunds",
  ];
  for (const resource of resources) {
    const endpoint = resource === "staff" ? "users" : resource;
    const fault = (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/problem+json",
        body: JSON.stringify({
          title: "Deliberate browser-local test failure",
          status: 500,
        }),
      });
    const matcher = (url) =>
      url.pathname.replace(/\/$/, "") === `/api/v1/admin/${endpoint}`;
    await page.route(matcher, fault);
    await go(`/admin/${resource}`);
    const failure = page.locator(
      ".transaction-state--error, .admin-list-state--error",
    );
    await expect(failure).toBeVisible();
    await page.unroute(matcher, fault);
    await failure.getByRole("button").click();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    passed(`${resource}: API 500 handled and retry recovers real data`);
    await go(`/admin/${resource}/00000000-0000-0000-0000-000000000001`);
    await expect(
      page.locator(".transaction-state--not-found, .page-state").first(),
    ).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain(
      "Kh\u00f4ng th\u1ec3 t\u1ea3i trang",
    );
    passed(`${resource}: nonexistent record handled without page crash`);
  }
  const mappings = {
    bookings: {
      PENDING_PAYMENT: "pending-payment",
      CONFIRMED: "confirmed",
      PAID: "paid",
      COMPLETED: "completed",
      CANCELLED: "cancelled",
      EXPIRED: "expired",
      REFUND_PENDING: "awaiting-refund",
      REFUNDED: "refunded",
    },
    payments: {
      PENDING: "pending",
      PROCESSING: "pending",
      SUCCEEDED: "success",
      FAILED: "failed",
      CANCELLED: "cancelled",
      REFUND_PENDING: "awaiting-refund",
      PARTIALLY_REFUNDED: "partially-refunded",
      REFUNDED: "refunded",
    },
    refunds: {
      REQUESTED: "queued",
      PROCESSING: "processing",
      SUCCEEDED: "completed",
      COMPLETED: "completed",
      FAILED: "failed",
    },
  };
  for (const resource of ["bookings", "payments", "refunds"]) {
    const data = await all(resource);
    expect(data.length).toBeGreaterThan(0);
    for (const raw of [...new Set(data.map((row) => row.status))]) {
      const state = mappings[resource][raw];
      expect(state, `${resource} unmapped status ${raw}`).toBeTruthy();
      await go(`/admin/${resource}?status=${state}`);
      const expected = data.filter(
        (row) => mappings[resource][row.status] === state,
      );
      await expect(page.locator("tbody tr")).toHaveCount(
        Math.min(20, expected.length),
      );
      const label = await page
        .locator(`select option[value="${state}"]`)
        .textContent();
      for (const text of await page
        .locator("tbody tr td:nth-last-child(2) .admin-data-table__value")
        .allTextContents())
        expect(text).toBe(label);
      const representative = expected[0];
      await go(`/admin/${resource}/${representative.id}`);
      await expect(
        page
          .locator(".transaction-page__fact")
          .filter({
            has: page.locator("dt", { hasText: /^Tr\u1ea1ng th\u00e1i$/ }),
          }),
      ).toContainText(label);
      await expect(
        page.locator(".transaction-page__history-entry").first(),
      ).toBeVisible();
      passed(`${resource}: ${raw} filter, count, detail and history`);
    }
    await go(`/admin/${resource}?page=99999`);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    expect(
      Number(new URL(page.url()).searchParams.get("page") || 1),
    ).toBeLessThan(99999);
    passed(`${resource}: out-of-range pagination corrects itself`);
    await page
      .locator(".transaction-filters input")
      .fill("no-such-record-29fa3710");
    await page.locator(".transaction-filters button[type=submit]").click();
    await expect(page.locator(".transaction-state--empty")).toBeVisible();
    expect(new URL(page.url()).searchParams.has("page")).toBeFalsy();
    await page.locator(".transaction-state--empty button").click();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    expect(new URL(page.url()).searchParams.has("query")).toBeFalsy();
    passed(`${resource}: empty search, page reset and clear filters`);
    if (data.length > 20) {
      const firstPage = await page
        .locator("tbody tr td:first-child a")
        .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
      await go(`/admin/${resource}?page=2`);
      await expect(page.locator("tbody tr").first()).toBeVisible();
      const secondPage = await page
        .locator("tbody tr td:first-child a")
        .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
      expect(secondPage.some((id) => firstPage.includes(id))).toBeFalsy();
      await page.reload({ waitUntil: "networkidle" });
      expect(
        await page
          .locator("tbody tr td:first-child a")
          .evaluateAll((links) => links.map((a) => a.getAttribute("href"))),
      ).toEqual(secondPage);
      passed(`${resource}: distinct page two persists after reload`);
    }
    await go(`/admin/${resource}/${data[0].id}`);
    await expect(
      page.locator(".transaction-page__history-entry").first(),
    ).toBeVisible();
    const before = await page
      .locator(".transaction-page__fact")
      .allTextContents();
    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.locator(".transaction-page__history-entry").first(),
    ).toBeVisible();
    expect(
      await page.locator(".transaction-page__fact").allTextContents(),
    ).toEqual(before);
    passed(`${resource}: detail survives hard reload with identical facts`);
  }
  for (const resource of ["bookings", "payments", "refunds"]) {
    const row = (await all(resource))[0];
    for (const route of [
      `/api/v1/admin/${resource}`,
      `/api/v1/admin/${resource}/${row.id}/audit`,
    ]) {
      expect((await page.request.get(base + route)).status()).toBe(401);
    }
  }
  passed("Anonymous list and audit endpoints reject access");
  const customerResponse = await page.request.post(
    base + "/api/v1/auth/login",
    {
      data: {
        identifier: "seed.customer@example.test",
        password: "CustomerPass1",
      },
    },
  );
  expect(customerResponse.ok()).toBeTruthy();
  const customer = await customerResponse.json();
  for (const resource of ["bookings", "payments", "refunds"]) {
    const row = (await all(resource))[0];
    for (const route of [
      `/api/v1/admin/${resource}`,
      `/api/v1/admin/${resource}/${row.id}/audit`,
    ]) {
      expect(
        (
          await page.request.get(base + route, {
            headers: { Authorization: `Bearer ${customer.accessToken}` },
          })
        ).status(),
      ).toBe(403);
    }
  }
  passed("Customer role denied list and audit endpoints");
  // Expire only our browser-local timestamp to exercise the application's refresh path.
  const oldRefresh = await page.evaluate(() => {
    const session = JSON.parse(sessionStorage.getItem("blue-api-session"));
    const old = session.refreshToken;
    session.expiresAt = Date.now() - 1000;
    sessionStorage.setItem("blue-api-session", JSON.stringify(session));
    return old;
  });
  await go("/admin/organizations");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(sessionStorage.getItem("blue-api-session")).refreshToken,
    ),
  ).not.toBe(oldRefresh);
  passed("Expired local session refreshes and rotates token");
  expect(errors).toEqual([]);
  fs.writeFileSync(
    path.join(os.tmpdir(), "pbl6-admin-resilience-verification.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(`Completed ${checks.length} checks with no browser crashes.`);
} catch (error) {
  console.error("FAILED at", page.url(), error.message);
  console.error((await page.locator("body").innerText()).slice(-1800));
  process.exitCode = 1;
} finally {
  await browser.close();
}
