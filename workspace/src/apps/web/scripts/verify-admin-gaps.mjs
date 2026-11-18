/* global console, process, sessionStorage, URL, crypto */
// Additional checks for every exposed admin action missed by the baseline suites.
import { chromium, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
const base = "http://localhost:5175";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const owned = { users: [], organizations: [] };
const crashes = [];
page.on("pageerror", (error) => crashes.push(error.message));
const pass = (name) => console.log("PASS:", name);
const go = (route) => page.goto(base + route, { waitUntil: "networkidle" });
let token;
async function api(route, method = "GET", data) {
  const response = await page.request.fetch(base + route, {
    method,
    data,
    headers: {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": crypto.randomUUID(),
    },
  });
  expect(
    response.ok(),
    `${method} ${route}: ${response.status()}`,
  ).toBeTruthy();
  return response.status() === 204 ? null : response.json();
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
try {
  await go("/login");
  let loginRequests = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/v1/auth/login") loginRequests++;
  });
  await page.locator("button[type=submit]").click();
  expect(loginRequests).toBe(0);
  await page.locator("input[type=email]").fill("invalid-email");
  await page.locator('input[autocomplete="current-password"]').fill("invalid");
  await page.locator("button[type=submit]").click();
  expect(loginRequests).toBe(0);
  pass("Login required fields and malformed email blocked before API");
  const password = page.locator('input[autocomplete="current-password"]');
  await page.locator("input[type=checkbox]").check();
  await expect(password).toHaveAttribute("type", "text");
  await page.locator("input[type=checkbox]").uncheck();
  await expect(password).toHaveAttribute("type", "password");
  pass("Login show/hide password");
  // One invalid attempt on a nonexistent identity cannot lock a real account.
  await page
    .locator("input[type=email]")
    .fill(`missing-admin-${Date.now()}@example.test`);
  await page.locator("button[type=submit]").click();
  await expect(page.locator("[role=alert]")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/login");
  pass("Invalid credentials stay at login with error");
  await page
    .locator("input[type=email]")
    .fill(process.env.ADMIN_TEST_EMAIL || "admin.seed@example.test");
  await password.fill(process.env.ADMIN_TEST_PASSWORD || "AdminPass1234");
  await page.locator("button[type=submit]").click();
  await page.waitForURL("**/admin/organizations");
  token = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("blue-api-session")).accessToken,
  );
  pass("Correct admin credentials log in");
  for (const resource of [
    "staff",
    "bookings",
    "payments",
    "refunds",
    "organizations",
  ]) {
    await page
      .locator(`.admin-layout__desktop-navigation a[href="/admin/${resource}"]`)
      .click();
    await page.waitForURL(`**/admin/${resource}`);
    await expect(
      page.locator(
        `.admin-layout__desktop-navigation a[href="/admin/${resource}"]`,
      ),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.locator("tbody tr").first()).toBeVisible();
  }
  await page.locator(".admin-layout__logo").click();
  await page.waitForURL("**/admin/organizations");
  pass("All five desktop navigation links, active state and logo");
  await page.locator(".admin-layout__account").click();
  const account = page.locator(".admin-layout__account-dialog");
  await expect(account).toBeVisible();
  const customerLink = await account.locator("a").getAttribute("href");
  expect(new URL(customerLink).port).toBe("5173");
  expect((await page.request.get(customerLink)).ok()).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(account).toHaveCount(0);
  pass("Account dialog closes and customer portal link responds");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const resource of [
    "staff",
    "bookings",
    "payments",
    "refunds",
    "organizations",
  ]) {
    await page.locator(".admin-layout__menu-button").click();
    await expect(page.locator(".admin-layout__drawer")).toBeVisible();
    await page
      .locator(`.admin-layout__drawer a[href="/admin/${resource}"]`)
      .click();
    await page.waitForURL(`**/admin/${resource}`);
    await expect(page.locator(".admin-layout__drawer")).toHaveCount(0);
  }
  await page.locator(".admin-layout__menu-button").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".admin-layout__drawer")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  pass("All five mobile navigation links and Escape close menu");
  // Create isolated fixtures only; all are removed in finally.
  const stamp = Date.now();
  const organization = await api("/api/v1/admin/organizations", "POST", {
    code: "QA-" + crypto.randomUUID(),
    name: `Admin gap check ${stamp}`,
    contactEmail: `gap-${stamp}@example.test`,
    contactPhone: "0900000888",
    expectedVersion: 0,
  });
  owned.organizations.push(organization.id);
  const user = await api("/api/v1/admin/users", "POST", {
    fullName: `Admin gap check ${stamp}`,
    email: `admin-gap-check-${stamp}@example.test`,
    phone: "08" + String(stamp).slice(-8),
    expectedVersion: 0,
  });
  owned.users.push(user.id);
  await go(`/admin/organizations/${organization.id}?view=members`);
  await expect(
    page.locator(".organization-page__members tbody tr"),
  ).toHaveCount(0);
  pass("New organization has no invented members");
  await page.locator(".organization-page__member-filters button").click();
  let dialog = page.locator(".membership-dialog__content");
  await dialog.locator("button[type=submit]").click();
  await expect(dialog.locator("[role=alert]").first()).toBeVisible();
  expect(
    (await api(`/api/v1/admin/organizations/${organization.id}/members`))
      .length,
  ).toBe(0);
  pass("Membership requires employee, role and reason before API write");
  await dialog.locator("select[name=staffId]").selectOption(user.id);
  await dialog.locator("select[name=role]").selectOption("OPERATOR_ADMIN");
  await dialog
    .locator("[name=reason]")
    .fill("Owned test organization membership");
  await dialog.locator("button[type=submit]").click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".organization-page__members tbody tr"),
  ).toHaveCount(1);
  let membership = (
    await api(`/api/v1/admin/organizations/${organization.id}/members`)
  ).find((m) => m.userId === user.id);
  expect(membership.roleCodes).toContain("OPERATOR_ADMIN");
  pass("Organization members page adds real member and role");
  await page.locator(".organization-page__members tbody tr button").click();
  dialog = page.locator(".membership-dialog__content");
  await dialog.locator("select[name=role]").selectOption("DRIVER");
  await dialog.locator("select[name=status]").selectOption("inactive");
  await dialog.locator("[name=reason]").fill("Owned test suspension");
  await dialog.locator("button[type=submit]").click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".organization-page__members tbody tr"),
  ).toHaveCount(0);
  await page
    .locator(".organization-page__member-filters select")
    .selectOption("inactive");
  await expect(
    page.locator(".organization-page__members tbody tr"),
  ).toHaveCount(1);
  membership = (
    await api(`/api/v1/admin/organizations/${organization.id}/members`)
  ).find((m) => m.userId === user.id);
  expect(membership.status).toBe("SUSPENDED");
  expect(membership.roleCodes).toContain("DRIVER");
  await page.reload({ waitUntil: "networkidle" });
  await expect(
    page.locator(".organization-page__members tbody tr"),
  ).toHaveCount(1);
  pass(
    "Organization edits role, suspends membership, filters statuses and survives reload",
  );
  await go(`/admin/organizations/${organization.id}`);
  await page
    .locator(`.organization-page__members a[href="/admin/staff/${user.id}"]`)
    .click();
  await page.waitForURL("**/admin/staff/" + user.id);
  await expect(
    page.locator(".staff-page__membership-table tbody tr"),
  ).toHaveCount(1);
  pass("Organization member profile link opens correct employee");
  // Exercise platform-only role branch on another owned user, without changing an existing user's privileges.
  const support = await api("/api/v1/admin/users", "POST", {
    fullName: `Admin gap support ${stamp}`,
    email: `admin-gap-check-support-${stamp}@example.test`,
    phone: "07" + String(stamp).slice(-8),
    expectedVersion: 0,
  });
  owned.users.push(support.id);
  await go("/admin/staff/" + support.id);
  await page
    .getByRole("button", { name: "S\u1eeda h\u1ed3 s\u01a1", exact: true })
    .click();
  let profileDialog = page.locator(".staff-dialog__content");
  await profileDialog
    .locator("select[name=role]")
    .selectOption("PLATFORM_SUPPORT");
  await profileDialog.locator("button[type=submit]").click();
  await expect(profileDialog).toHaveCount(0);
  expect((await api("/api/v1/admin/users/" + support.id)).roles).toContain(
    "PLATFORM_SUPPORT",
  );
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".staff-page__membership-table")).toContainText(
    "Hỗ trợ nền tảng",
  );
  pass("Assign platform support without organization and display after reload");
  await page.locator(".staff-page__membership-table tbody tr button").click();
  dialog = page.locator(".membership-dialog__content");
  await dialog.locator("button[type=submit]").click();
  await expect(dialog.locator("[role=alert]")).toBeVisible();
  await dialog
    .locator("input[name=reason]")
    .fill("Owned test platform role confirmation");
  await dialog.locator("button[type=submit]").click();
  await expect(dialog).toHaveCount(0);
  expect((await api("/api/v1/admin/users/" + support.id)).roles).toContain(
    "PLATFORM_SUPPORT",
  );
  pass("Platform role dialog requires reason and saves through live API");
  await api(`/api/v1/admin/organizations/${organization.id}/members`, "POST", {
    userId: support.id,
    roleCodes: ["OPERATOR_SCHEDULER"],
    status: "ACTIVE",
    reason: "Owned test combined role scopes",
    expectedVersion: 0,
  });
  const combined = await api("/api/v1/admin/users/" + support.id);
  expect(combined.roles).toContain("PLATFORM_SUPPORT");
  expect(
    combined.organizationMemberships.find(
      (m) => m.organizationId === organization.id,
    ).roleCodes,
  ).toContain("OPERATOR_SCHEDULER");
  pass("Combined platform and organization roles retain their separate scopes");
  for (const resource of ["organizations", "staff"]) {
    await go("/admin/" + resource);
    const search = page.locator(".admin-filters input");
    await search.fill(
      resource === "organizations" ? organization.name : user.email,
    );
    await search.press("Enter");
    const id = resource === "organizations" ? organization.id : user.id;
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(
      page.locator(`tbody a[href="/admin/${resource}/${id}"]`).first(),
    ).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await search.fill("no-such-admin-record-28cf01");
    await search.press("Enter");
    await expect(page.locator(".admin-list-state--empty")).toBeVisible();
    await page
      .locator(".admin-filters")
      .getByRole("button", { name: "X\u00f3a b\u1ed9 l\u1ecdc", exact: true })
      .click();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    pass(`${resource}: real text search, reload, no results and clear filters`);
    await page
      .locator(".admin-filters select")
      .first()
      .selectOption("inactive");
    if (await page.locator("tbody tr").count()) {
      const statuses = await page
        .locator(
          `.${resource === "staff" ? "staff" : "organization"}-page__status`,
        )
        .allTextContents();
      expect(statuses.every((s) => s === "T\u1ea1m ng\u01b0ng")).toBeTruthy();
    }
    pass(`${resource}: inactive filter returns no active rows`);
  }
  await go("/admin/staff?organizationId=" + organization.id);
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody")).toContainText(user.fullName);
  pass("Staff organization filter includes correct assigned user");
  for (const resource of [
    "organizations",
    "staff",
    "bookings",
    "payments",
    "refunds",
  ]) {
    const endpoint = resource === "staff" ? "users" : resource;
    const data = await all(endpoint);
    // Organizations have fewer than 20 rows; use supported smaller page size to exercise pagination.
    await go(`/admin/${resource}?pageSize=5`);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    const pagination = page.locator(".admin-filters__pagination");
    if (data.length > 5) {
      await expect(pagination).toBeVisible();
      const buttons = pagination.locator("button");
      await expect(buttons.nth(0)).toBeDisabled();
      await expect(buttons.nth(1)).toBeDisabled();
      const first = await page.locator("tbody tr").first().innerText();
      await buttons.nth(2).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(page.locator("tbody tr").first()).not.toHaveText(first);
      // With two pages, Next already lands on Last. Return first to exercise Last.
      await buttons.nth(0).click();
      await expect(buttons.nth(0)).toBeDisabled();
      await buttons.nth(3).click();
      await expect(buttons.nth(3)).toBeDisabled();
      await buttons.nth(1).click();
      await expect(buttons.nth(3)).toBeEnabled();
      if (await buttons.nth(0).isEnabled()) await buttons.nth(0).click();
      await expect(buttons.nth(0)).toBeDisabled();
      pass(`${resource}: first, previous, next, last pagination buttons`);
    } else {
      pass(`${resource}: pagination hidden when only one page`);
    }
  }
  for (const resource of ["bookings", "payments", "refunds"]) {
    const data = await all(resource);
    const representative = data[0];
    const actual = await api(`/api/v1/${resource}/${representative.id}`);
    const audit = await api(
      `/api/v1/admin/${resource}/${representative.id}/audit`,
    );
    await go(`/admin/${resource}/${representative.id}`);
    await expect(page.locator(".transaction-page__fact").first()).toBeVisible();
    const facts = page.locator(".transaction-page__fact");
    const moneyLabel =
      resource === "bookings"
        ? "T\u1ed5ng gi\u00e1 tr\u1ecb \u0111\u01a1n"
        : resource === "payments"
          ? "S\u1ed1 ti\u1ec1n giao d\u1ecbch"
          : "S\u1ed1 ti\u1ec1n ho\u00e0n";
    const money = facts
      .filter({
        has: page.locator("dt", {
          hasText: new RegExp("^" + moneyLabel + "$"),
        }),
      })
      .locator("dd");
    expect(Number((await money.innerText()).replace(/\D/g, ""))).toBe(
      resource === "bookings" ? actual.total : actual.amount,
    );
    const created = facts
      .filter({ has: page.locator("dt", { hasText: /^Ng\u00e0y t\u1ea1o$/ }) })
      .locator("dd");
    const date = new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(actual.createdAt));
    await expect(created).toContainText(date);
    expect(await page.locator(".transaction-page__history-entry").count()).toBe(
      audit.history.length,
    );
    for (const event of audit.history)
      await expect(page.locator(".transaction-page__history")).toContainText(
        event.description,
      );
    pass(
      `${resource}: amount, creation date and history compared directly with API`,
    );
    if (resource === "bookings") {
      expect(audit.seats.length).toBeGreaterThan(0);
      const seats = facts
        .filter({ has: page.locator("dt", { hasText: /^Gh\u1ebf$/ }) })
        .locator("dd");
      for (const code of audit.seats) await expect(seats).toContainText(code);
      pass(
        "Booking seat codes match stored booking items, including unpaid/expired bookings",
      );
    }
    let linked = false;
    const paymentsForLinks =
      resource === "bookings" ? await all("payments") : [];
    const candidates =
      resource === "bookings"
        ? data.filter((row) =>
            paymentsForLinks.some((payment) => payment.bookingId === row.id),
          )
        : data;
    for (const row of candidates.slice(0, 5)) {
      await go(`/admin/${resource}/${row.id}`);
      await expect(
        page.locator(".transaction-page__fact").first(),
      ).toBeVisible();
      const link = page.locator(".transaction-page__related-link").first();
      if (!(await link.count())) continue;
      const href = await link.getAttribute("href");
      await link.click();
      await expect(page).toHaveURL(base + href);
      await expect(
        page.locator(".transaction-page__fact").first(),
      ).toBeVisible();
      await page.goBack({ waitUntil: "networkidle" });
      await expect(page).toHaveURL(base + `/admin/${resource}/${row.id}`);
      await page.locator(".transaction-page__back").click();
      await expect(page).toHaveURL(base + `/admin/${resource}`);
      linked = true;
      break;
    }
    expect(linked, `${resource} linked record fixture`).toBeTruthy();
    pass(
      `${resource}: related record navigation, browser back and return to list`,
    );
  }
  const orgs = await all("organizations");
  const summaryText = `${orgs.filter((o) => o.status === "ACTIVE").length} \u0111ang ho\u1ea1t \u0111\u1ed9ng`;
  await go("/admin/organizations?pageSize=1");
  await expect(page.locator(".organization-page__meta")).toContainText(
    summaryText,
  );
  await go("/admin/organizations?pageSize=1&page=2");
  await expect(page.locator(".organization-page__meta")).toContainText(
    summaryText,
  );
  pass("Organization summary counts the full filtered dataset on every page");
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
  const context = await browser.newContext();
  await context.addInitScript(
    (session) =>
      sessionStorage.setItem(
        "blue-api-session",
        JSON.stringify({
          ...session,
          expiresAt: Date.now() + session.expiresIn * 1000,
        }),
      ),
    customer,
  );
  const denied = await context.newPage();
  await denied.goto(base + "/admin/organizations", {
    waitUntil: "networkidle",
  });
  await expect(denied.locator("#admin-forbidden-title")).toBeVisible();
  await context.close();
  pass("Customer authenticated session cannot open admin UI");
  await page.locator(".admin-layout__account").click();
  await page
    .locator(".admin-layout__account-dialog")
    .getByRole("button", { name: "\u0110\u0103ng xu\u1ea5t", exact: true })
    .click();
  await page.waitForURL("**/login");
  await go("/admin/staff");
  await page.waitForURL("**/login");
  expect(
    await page.evaluate(() => sessionStorage.getItem("blue-api-session")),
  ).toBeNull();
  pass("Logout clears local session and blocks direct admin reentry");
  expect(crashes).toEqual([]);
  pass("No unhandled browser exceptions throughout additional flows");
} catch (error) {
  console.error("FAILED:", page.url(), error.message);
  console.error((await page.locator("body").innerText()).slice(-1800));
  process.exitCode = 1;
} finally {
  await browser.close();
  for (const [resource, ids] of Object.entries(owned))
    for (const id of ids) {
      if (!/^[0-9a-f-]{36}$/.test(id)) {
        process.exitCode = 1;
        continue;
      }
      const sql =
        resource === "users"
          ? `BEGIN; DELETE FROM user_roles WHERE user_id='${id}' AND user_id IN (SELECT id FROM users WHERE id='${id}' AND email LIKE 'admin-gap-check-%@example.test'); DELETE FROM organization_memberships WHERE user_id='${id}' AND user_id IN (SELECT id FROM users WHERE id='${id}' AND email LIKE 'admin-gap-check-%@example.test'); DELETE FROM security_audits WHERE target_user_id='${id}' AND target_user_id IN (SELECT id FROM users WHERE id='${id}' AND email LIKE 'admin-gap-check-%@example.test'); DELETE FROM users WHERE id='${id}' AND email LIKE 'admin-gap-check-%@example.test'; COMMIT;`
          : `BEGIN; DELETE FROM operator_resource_metadata WHERE organization_id='${id}' AND organization_id IN (SELECT id FROM organizations WHERE id='${id}' AND name LIKE 'Admin gap check %'); DELETE FROM organizations WHERE id='${id}' AND name LIKE 'Admin gap check %'; COMMIT;`;
      const result = spawnSync(
        "docker",
        [
          "exec",
          "pbl6-local-postgres-1",
          "psql",
          "-U",
          "platform",
          "-d",
          resource === "users" ? "identity" : "transport",
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          sql,
        ],
        { encoding: "utf8", windowsHide: true },
      );
      if (result.status !== 0) {
        console.error("Owned fixture cleanup failed:", result.stderr);
        process.exitCode = 1;
      }
    }
}
