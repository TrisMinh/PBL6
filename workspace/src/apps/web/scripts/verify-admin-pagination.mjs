/* global console, window, document, setTimeout */
import { chromium, expect } from "@playwright/test";
import path from "node:path";
import os from "node:os";
const base = "http://localhost:5175";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 560 } });
page.setDefaultTimeout(20000);
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
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 560 });
    for (const resource of [
      "organizations",
      "staff",
      "bookings",
      "payments",
      "refunds",
    ]) {
      await page.goto(base + `/admin/${resource}?pageSize=5&future=keep`, {
        waitUntil: "networkidle",
      });
      const rows = page.locator("tbody tr");
      await expect(rows).toHaveCount(5);
      const pager = page.locator(".admin-filters__pagination");
      await expect(pager).toBeVisible();
      expect(
        await pager.evaluate(
          (node) =>
            !node.closest(".admin-filters") &&
            Boolean(node.closest(".admin-list-footer")),
        ),
      ).toBeTruthy();
      expect(
        await pager.evaluate(
          (node) =>
            node.getBoundingClientRect().top >=
            document.querySelector("table").getBoundingClientRect().bottom,
        ),
      ).toBeTruthy();
      const next = pager.getByRole("button", {
        name: "Trang tiếp theo",
        exact: true,
      });
      await next.scrollIntoViewIfNeeded();
      const buttonHeight = await next.evaluate(
        (node) => node.getBoundingClientRect().height,
      );
      expect(buttonHeight).toBeLessThanOrEqual(width === 1440 ? 34 : 42);
      const before = await page.evaluate(() => window.scrollY);
      expect(before).toBeGreaterThan(50);
      const first = await rows
        .first()
        .locator("a")
        .first()
        .getAttribute("href");
      expect(first).toBeTruthy();
      await page.evaluate(() => {
        window.__adminPageScroll = [window.scrollY];
        window.onscroll = () => window.__adminPageScroll.push(window.scrollY);
      });
      const endpoint = resource === "staff" ? "users" : resource;
      const matcher = (url) =>
        url.pathname.replace(/\/$/, "") === `/api/v1/admin/${endpoint}`;
      const delayed = async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.continue();
      };
      await page.route(matcher, delayed);
      await next.click();
      await expect(page).toHaveURL(/page=2/);
      await expect(next).toBeDisabled();
      await expect(rows).toHaveCount(5);
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(
        before - 5,
      );
      await expect(rows.first().locator("a").first()).not.toHaveAttribute(
        "href",
        first,
      );
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await page.unroute(matcher, delayed);
      const after = await page.evaluate(() => ({
        y: window.scrollY,
        samples: window.__adminPageScroll,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }));
      expect(after.y).toBeGreaterThan(30);
      expect(Math.min(...after.samples)).toBeGreaterThan(30);
      expect(after.overflow).toBeLessThanOrEqual(1);
      if (resource === "staff")
        await page.screenshot({
          path: path.join(os.tmpdir(), `pbl6-pagination-${width}.png`),
          fullPage: true,
        });
      await pager
        .getByRole("button", { name: "Trang trước", exact: true })
        .click();
      await expect(pager.locator(".admin-filters__page-status")).toContainText(
        "Trang 1 /",
      );
      await expect(rows.first().locator("a").first()).toHaveAttribute(
        "href",
        first,
      );
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(30);
      const beforeLast = await page.evaluate(() => window.scrollY);
      const last = pager.getByRole("button", {
        name: "Trang cuối",
        exact: true,
      });
      await last.click();
      await expect(rows.first().locator("a").first()).not.toHaveAttribute(
        "href",
        first,
      );
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await expect(last).toBeDisabled();
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(
        beforeLast - 5,
      );
      await pager
        .getByRole("button", { name: "Trang đầu", exact: true })
        .click();
      await expect(rows.first().locator("a").first()).toHaveAttribute(
        "href",
        first,
      );
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(30);
      console.log(
        `PASS: ${resource} ${width}px: compact footer pagination; table stays visible and scroll never resets on next/previous/last/first, including short last pages`,
      );
    }
  }
  expect(errors).toEqual([]);
  await page.evaluate(() => {
    window.onscroll = null;
  });
  await page.locator(".admin-layout__account").click();
  await page.locator(".admin-layout__account-actions button").click();
  await page.waitForURL("**/login");
} finally {
  await browser.close();
}
