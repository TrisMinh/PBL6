/* global console, sessionStorage, URL */
import { chromium, expect } from "@playwright/test";
const base = "http://localhost:5175";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
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
  async function api(route) {
    const response = await page.request.get(base + route, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
    return response.json();
  }
  const code = (resource, record) =>
    resource === "bookings"
      ? record.code
      : resource === "payments"
        ? record.paymentReference
        : record.refundReference;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const resource of ["bookings", "payments", "refunds"]) {
    const rows = (await api(`/api/v1/admin/${resource}?page=0&size=100`)).items;
    const record = rows.find(
      (record) => code(resource, record) && !uuid.test(code(resource, record)),
    );
    expect(record, `${resource} business code fixture`).toBeTruthy();
    const reference = code(resource, record);
    await page.goto(
      base + `/admin/${resource}?query=${encodeURIComponent(reference)}`,
      { waitUntil: "networkidle" },
    );
    const row = page
      .locator("tbody tr")
      .filter({
        has: page.locator(`a[href="/admin/${resource}/${record.id}"]`),
      });
    await expect(row.locator(".transaction-page__record-link")).toHaveText(
      reference,
    );
    await expect(row).not.toContainText(record.id);
    if (resource === "payments") {
      const booking = await api(`/api/v1/bookings/${record.bookingId}`);
      await expect(
        row.locator("td").nth(1).locator(".admin-data-table__value"),
      ).toHaveText(booking.code);
      await expect(row).not.toContainText(record.bookingId);
    }
    if (resource === "refunds") {
      const payment = await api(`/api/v1/payments/${record.paymentId}`);
      await expect(
        row.locator("td").nth(1).locator(".admin-data-table__value"),
      ).toHaveText(payment.paymentReference);
      await expect(row).not.toContainText(record.paymentId);
    }
    console.log(
      `PASS: ${resource} list and search show actual business codes instead of database IDs`,
    );
    await row.locator(".transaction-page__record-link").click();
    await expect(page).toHaveURL(base + `/admin/${resource}/${record.id}`);
    await expect(page.locator(".transaction-page__description")).toContainText(
      reference,
    );
    await expect(
      page.locator(".transaction-page__description"),
    ).not.toContainText(record.id);
    await expect(page.locator(".transaction-page__fact dd").first()).toHaveText(
      reference,
    );
    const links = page.locator(".transaction-page__related-link");
    for (const link of await links.all()) {
      const [relatedResource, id] = new URL(
        await link.getAttribute("href"),
        base,
      ).pathname
        .split("/")
        .slice(-2);
      const related = await api(`/api/v1/${relatedResource}/${id}`);
      await expect(link).toHaveText(code(relatedResource, related));
      expect(await link.innerText()).not.toBe(id);
    }
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(".transaction-page__fact dd").first()).toHaveText(
      reference,
    );
    console.log(
      `PASS: ${resource} detail, related codes, UUID navigation and reload`,
    );
  }
  expect(errors).toEqual([]);
  await page.locator(".admin-layout__account").click();
  await page.locator(".admin-layout__account-actions button").click();
  await page.waitForURL("**/login");
} finally {
  await browser.close();
}
