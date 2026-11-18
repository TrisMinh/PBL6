/* global process, console, sessionStorage, URL, document, window */
import { chromium, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
const base = "http://localhost:5175";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(20000);
const owned = [];
const crashes = [];
page.on("pageerror", (e) => crashes.push(e.message));
const stamp = Date.now();
const name = `Admin form check ${stamp}`;
let writes = 0;
page.on("request", (request) => {
  if (
    request.method() === "POST" &&
    new URL(request.url()).pathname.replace(/\/$/, "") ===
      "/api/v1/admin/organizations"
  )
    writes++;
});
try {
  await page.goto(base + "/login");
  await page
    .locator("input[type=email]")
    .fill(process.env.ADMIN_TEST_EMAIL || "admin.seed@example.test");
  await page
    .locator('input[autocomplete="current-password"]')
    .fill(process.env.ADMIN_TEST_PASSWORD || "AdminPass1234");
  await page.locator("button[type=submit]").click();
  await page.waitForURL("**/admin/organizations");
  const token = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("blue-api-session")).accessToken,
  );
  await page.goto(base + "/admin/organizations?dialog=create", {
    waitUntil: "networkidle",
  });
  const dialog = page.locator(".organization-dialog__content");
  await expect(dialog).toBeVisible();
  await dialog.locator("button[type=submit]").click();
  await expect(dialog.locator('[aria-invalid="true"]').first()).toBeVisible();
  expect(writes).toBe(0);
  console.log("PASS: empty organization form validates without API write");
  await dialog.locator("input[name=name]").fill(name);
  await dialog.locator("input[name=legalName]").fill(name + " Legal");
  await dialog.locator("input[name=taxId]").fill("0123456789");
  await dialog.locator("input[name=address]").fill("Test form address");
  await dialog
    .locator("input[name=contactEmail]")
    .fill(`admin-form-${stamp}@example.test`);
  await dialog.locator("input[name=contactPhone]").fill("123");
  await dialog.locator("button[type=submit]").click();
  await expect(dialog.locator("input[name=contactPhone]")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(writes).toBe(0);
  console.log("PASS: invalid phone blocked before sending");
  await dialog.locator("input[name=contactPhone]").fill("+84900000123");
  const created = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname.replace(/\/$/, "") ===
        "/api/v1/admin/organizations",
  );
  await dialog.locator("button[type=submit]").click();
  const response = await created;
  expect(response.status()).toBe(201);
  const record = await response.json();
  owned.push(record.id);
  await expect(dialog).toHaveCount(0);
  const profileResponse = await page.request.get(
    base + `/api/v1/admin/organizations/${record.id}/profile`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(profileResponse.status()).toBe(200);
  const profile = await profileResponse.json();
  expect(profile.name).toBe(name);
  expect(profile.legalName).toBe(name + " Legal");
  expect(profile.contactPhone).toBe("+84900000123");
  expect(profile.taxId).toBe("0123456789");
  expect(writes).toBe(1);
  console.log(
    "PASS: create organization through UI persists complete profile exactly once",
  );
  await page.goto(base + `/admin/organizations/${record.id}?dialog=edit`, {
    waitUntil: "networkidle",
  });
  await expect(dialog.locator("input[name=name]")).toHaveValue(name);
  await dialog.locator("input[name=name]").fill(name + " UNSAVED");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  expect(await page.locator("body").innerText()).not.toContain("UNSAVED");
  console.log("PASS: cancel edit does not persist changes");
  await page.goto(base + "/admin/staff?dialog=profile", {
    waitUntil: "networkidle",
  });
  // Profile dialog uses its own action, while ?dialog=create opens membership assignment.
  if (!(await page.locator(".staff-dialog__content").count())) {
    await page
      .getByRole("button", {
        name: "T\u1ea1o h\u1ed3 s\u01a1 nh\u00e2n vi\u00ean",
        exact: true,
      })
      .click();
  }
  const staffDialog = page.locator(".staff-dialog__content");
  await staffDialog.locator("button[type=submit]").click();
  await expect(
    staffDialog.locator('[aria-invalid="true"]').first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(staffDialog).toHaveCount(0);
  console.log("PASS: staff profile required fields and cancel");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const resource of [
    "organizations",
    "staff",
    "bookings",
    "payments",
    "refunds",
  ]) {
    await page.goto(base + "/admin/" + resource, { waitUntil: "networkidle" });
    await expect(page.locator("tbody tr").first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${resource} mobile overflow`).toBeLessThanOrEqual(1);
  }
  console.log(
    "PASS: all five mobile lists render without horizontal page overflow",
  );
  expect(crashes).toEqual([]);
} catch (error) {
  console.error("FAILED:", page.url(), error.message);
  console.error((await page.locator("body").innerText()).slice(-1500));
  process.exitCode = 1;
} finally {
  await browser.close();
  for (const id of owned) {
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      console.error("Unsafe owned ID");
      process.exitCode = 1;
      continue;
    }
    const sql = `BEGIN; DELETE FROM operator_resource_metadata WHERE organization_id='${id}' AND organization_id IN (SELECT id FROM organizations WHERE id='${id}' AND name='${name}'); DELETE FROM organizations WHERE id='${id}' AND name='${name}'; COMMIT;`;
    const result = spawnSync(
      "docker",
      [
        "exec",
        "pbl6-local-postgres-1",
        "psql",
        "-U",
        "platform",
        "-d",
        "transport",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
      ],
      { encoding: "utf8", windowsHide: true },
    );
    if (result.status !== 0) {
      console.error("Owned form test cleanup failed: " + result.stderr);
      process.exitCode = 1;
    }
  }
}
