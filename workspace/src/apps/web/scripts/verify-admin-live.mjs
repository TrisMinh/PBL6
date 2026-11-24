/* global process, console, crypto, sessionStorage, URL */
// Local Docker integration checks. Chromium stays headless; only owned test records are removed.
import { chromium, expect } from "@playwright/test";
import { chooseAdminFilter } from "./admin-filter-select.mjs";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const base = "http://localhost:5175";
const owned = { users: [], organizations: [] };
const ownershipFile = path.join(
  os.tmpdir(),
  "pbl6-admin-integration-owned.json",
);
const persist = () => fs.writeFileSync(ownershipFile, JSON.stringify(owned));
const safeId = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function sql(database, statement) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      process.env.PBL6_POSTGRES_CONTAINER || "pbl6-operating-postgres-1",
      "psql",
      "-U",
      "platform",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      statement,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error(`Test cleanup failed: ${result.stderr}`);
}
function cleanup() {
  for (const id of owned.users) {
    if (!safeId(id)) throw new Error("Invalid owned user ID");
    sql(
      "identity",
      `BEGIN; DELETE FROM user_roles WHERE user_id='${id}' AND user_id IN (SELECT id FROM users WHERE id='${id}' AND email LIKE 'admin-api-check-%@example.test'); DELETE FROM organization_memberships WHERE user_id='${id}' AND user_id IN (SELECT id FROM users WHERE id='${id}' AND email LIKE 'admin-api-check-%@example.test'); DELETE FROM security_audits WHERE target_user_id='${id}' AND target_user_id IN (SELECT id FROM users WHERE id='${id}' AND email LIKE 'admin-api-check-%@example.test'); DELETE FROM users WHERE id='${id}' AND email LIKE 'admin-api-check-%@example.test'; COMMIT;`,
    );
  }
  for (const id of owned.organizations) {
    if (!safeId(id)) throw new Error("Invalid owned organization ID");
    sql(
      "transport",
      `BEGIN; DELETE FROM operator_resource_metadata WHERE organization_id='${id}' AND organization_id IN (SELECT id FROM organizations WHERE id='${id}' AND code LIKE 'QA-%'); DELETE FROM organizations WHERE id='${id}' AND code LIKE 'QA-%'; COMMIT;`,
    );
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(25000);
  const errors = [];
  const checks = [];
  const loginEvents = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/auth/login")
      loginEvents.push("request sent");
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/api/v1/auth/login")
      loginEvents.push(`response ${response.status()}`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  let token;
  async function api(endpoint, method = "GET", data) {
    const response = await page.request.fetch(base + endpoint, {
      method,
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === "POST"
          ? { "Idempotency-Key": crypto.randomUUID() }
          : {}),
      },
    });
    if (!response.ok())
      throw new Error(
        `${method} ${endpoint}: ${response.status()} ${(await response.text()).slice(0, 300)}`,
      );
    return response.status() === 204 ? null : response.json();
  }
  async function all(resource) {
    const items = [];
    for (let index = 0; ; index++) {
      const result = await api(
        `/api/v1/admin/${resource}?page=${index}&size=100`,
      );
      items.push(...result.items);
      if (index + 1 >= result.totalPages) return items;
    }
  }
  function passed(value) {
    checks.push(value);
    console.log("PASS:", value);
  }
  try {
    await page.goto(base + "/login", { waitUntil: "networkidle" });
    await page
      .locator("input[type=email]")
      .fill(process.env.ADMIN_TEST_EMAIL || "admin@demo.blue.example.test");
    await page
      .locator('input[autocomplete="current-password"]')
      .fill(process.env.ADMIN_TEST_PASSWORD || "CustomerPass1");
    await page.locator("button[type=submit]").click();
    await page.waitForURL("**/admin/organizations");
    token = await page.evaluate(
      () => JSON.parse(sessionStorage.getItem("blue-api-session")).accessToken,
    );
    const stamp = Date.now();
    const organizations = [];
    for (const suffix of ["A", "B"]) {
      const organization = await api("/api/v1/admin/organizations", "POST", {
        code: "QA-" + crypto.randomUUID(),
        name: `Admin API check ${stamp} ${suffix}`,
        contactEmail: `admin-api-check-${stamp}-${suffix}@example.test`,
        contactPhone: "0900000999",
        expectedVersion: 0,
      });
      owned.organizations.push(organization.id);
      persist();
      organizations.push(organization);
    }
    await page.goto(
      base + "/admin/organizations/" + organizations[0].id + "?dialog=edit",
      { waitUntil: "networkidle" },
    );
    const organizationDialog = page.locator(".organization-dialog__content");
    await organizationDialog
      .locator("input[name=legalName]")
      .fill("Admin API check operator");
    await organizationDialog.locator("input[name=taxId]").fill("0123456789");
    await organizationDialog
      .locator("input[name=address]")
      .fill("Integration check address");
    await organizationDialog
      .locator("input[name=contactPhone]")
      .fill("+84900000999");
    await organizationDialog.locator("button[type=submit]").click();
    await organizationDialog.waitFor({ state: "detached" });
    expect(
      (
        await api(
          "/api/v1/admin/organizations/" + organizations[0].id + "/profile",
        )
      ).contactPhone,
    ).toBe("+84900000999");
    passed(
      "Edit organization legal/contact data including international phone",
    );
    await page.goto(base + "/admin/staff", { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: "Tạo hồ sơ nhân viên", exact: true })
      .click();
    let dialog = page.locator(".staff-dialog__content");
    await dialog.locator("input[name=fullName]").fill("Admin API check staff");
    await dialog
      .locator("input[name=email]")
      .fill(`admin-api-check-${stamp}@example.test`);
    await dialog
      .locator("input[name=phone]")
      .fill("09" + String(stamp).slice(-8));
    await dialog
      .locator("select[name=organizationId]")
      .selectOption(organizations[0].id);
    await dialog
      .locator("select[name=role]")
      .selectOption("OPERATOR_SCHEDULER");
    const createResponse = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname.replace(/\/$/, "") === "/api/v1/admin/users",
    );
    await dialog.locator("button[type=submit]").click();
    const createdResponse = await createResponse;
    expect(createdResponse.status()).toBe(201);
    const staff = await createdResponse.json();
    owned.users.push(staff.id);
    persist();
    await dialog.waitFor({ state: "detached" });
    passed("Create staff profile and initial organization membership");
    await page.goto(base + "/admin/staff/" + staff.id, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: "Sửa hồ sơ", exact: true }).click();
    dialog = page.locator(".staff-dialog__content");
    await dialog
      .locator("input[name=fullName]")
      .fill("Admin API check staff updated");
    await dialog.locator("button[type=submit]").click();
    await dialog.waitFor({ state: "detached" });
    expect((await api("/api/v1/admin/users/" + staff.id)).fullName).toBe(
      "Admin API check staff updated",
    );
    passed("Edit staff profile through live API");
    await page.goto(base + "/admin/staff?dialog=create", {
      waitUntil: "networkidle",
    });
    dialog = page.locator(".membership-dialog__content");
    await dialog
      .locator("select[name=organizationId]")
      .selectOption(organizations[1].id);
    await dialog.locator("select[name=staffId]").selectOption(staff.id);
    await dialog.locator("select[name=role]").selectOption("DRIVER");
    await dialog
      .locator("[name=reason]")
      .fill("Integration check second organization");
    await dialog.locator("button[type=submit]").click();
    await dialog.waitFor({ state: "detached" });
    await page.goto(base + "/admin/staff/" + staff.id, {
      waitUntil: "networkidle",
    });
    await expect(
      page.locator(".staff-page__membership-table tbody tr"),
    ).toHaveCount(2);
    await expect(page.locator(".staff-page__membership-table")).toContainText(
      "Lập lịch",
    );
    await expect(page.locator(".staff-page__membership-table")).toContainText(
      "Tài xế",
    );
    await expect(page.locator(".staff-page__detail-grid")).not.toContainText(
      staff.id,
    );
    const secondRow = page
      .locator(".staff-page__membership-table tbody tr")
      .filter({ hasText: organizations[1].name });
    await secondRow.getByRole("button").click();
    dialog = page.locator(".membership-dialog__content");
    await dialog.locator("select[name=status]").selectOption("inactive");
    await dialog
      .locator("[name=reason]")
      .fill("Integration check membership suspension");
    await dialog.locator("button[type=submit]").click();
    await dialog.waitFor({ state: "detached" });
    let secondMembership = (
      await api(`/api/v1/admin/organizations/${organizations[1].id}/members`)
    ).find((x) => x.userId === staff.id);
    expect(secondMembership.status).toBe("SUSPENDED");
    expect(secondMembership.roleCodes).toContain("DRIVER");
    await page.goto(
      base + "/admin/staff?organizationId=" + organizations[1].id,
      { waitUntil: "networkidle" },
    );
    await expect(
      page.locator(`a[href="/admin/staff/${staff.id}"]`).first(),
    ).toBeVisible();
    passed(
      "Display/filter both memberships and edit the selected organization",
    );
    await page.goto(base + "/admin/staff/" + staff.id, {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("button", { name: "Khóa tài khoản", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Mở khóa tài khoản", exact: true })
      .waitFor();
    expect((await api("/api/v1/admin/users/" + staff.id)).status).toBe(
      "DISABLED",
    );
    await page
      .getByRole("button", { name: "Mở khóa tài khoản", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Khóa tài khoản", exact: true })
      .waitFor();
    expect((await api("/api/v1/admin/users/" + staff.id)).status).toBe(
      "ACTIVE",
    );
    secondMembership = (
      await api(`/api/v1/admin/organizations/${organizations[1].id}/members`)
    ).find((x) => x.userId === staff.id);
    expect(secondMembership.status).toBe("SUSPENDED");
    passed("Lock/unlock account without overwriting organization permissions");

    const datasets = {
      bookings: await all("bookings"),
      payments: await all("payments"),
      refunds: await all("refunds"),
    };
    const cases = {
      bookings: ["REFUND_PENDING", "awaiting-refund", "Chờ hoàn tiền"],
      payments: ["REFUNDED", "refunded", "Đã hoàn tiền"],
      refunds: ["REQUESTED", "queued", "Chờ xử lý"],
    };
    for (const resource of ["bookings", "payments", "refunds"]) {
      const [rawState, viewState, label] = cases[resource];
      const record = datasets[resource].find((x) => x.status === rawState);
      if (!record)
        throw new Error(`Missing live test state ${resource}/${rawState}`);
      const organizationId =
        record.organizationId ||
        datasets.bookings.find((x) => x.id === record.bookingId)
          ?.organizationId;
      const expectedCount = datasets[resource].filter(
        (x) =>
          x.status === rawState &&
          (x.organizationId ||
            datasets.bookings.find((b) => b.id === x.bookingId)
              ?.organizationId) === organizationId,
      ).length;
      await page.goto(base + "/admin/" + resource, {
        waitUntil: "networkidle",
      });
      await page
        .getByRole("combobox", { name: "Trạng thái", exact: true })
        .selectOption(viewState);
      await chooseAdminFilter(page, "Nhà xe", organizationId);
      await expect(page.locator("tbody tr")).toHaveCount(
        Math.min(20, expectedCount),
      );
      await page.goto(base + "/admin/" + resource, {
        waitUntil: "networkidle",
      });
      const search = resource === "bookings" ? record.code : record.id;
      await page
        .getByRole("textbox", { name: "Tìm kiếm giao dịch" })
        .fill(search);
      await page.getByRole("button", { name: "Tra cứu", exact: true }).click();
      await expect(page.locator("tbody tr")).toHaveCount(1);
      if (resource === "bookings") {
        await expect(
          page.locator("tbody .transaction-page__record-link"),
        ).toHaveText(record.code);
        await expect(page.locator("tbody")).not.toContainText(record.id);
      }
      await expect(
        page.locator(`tbody a[href="/admin/${resource}/${record.id}"]`).first(),
      ).toBeVisible();
      await page
        .locator(`tbody a[href="/admin/${resource}/${record.id}"]`)
        .first()
        .click();
      await page.waitForURL("**/admin/" + resource + "/" + record.id);
      if (resource === "bookings") {
        await expect(
          page.locator(".transaction-page__description"),
        ).toContainText(record.code);
        await expect(
          page.locator(".transaction-page__description"),
        ).not.toContainText(record.id);
      }
      await page.locator(".transaction-page__history-entry").first().waitFor();
      await expect(
        page
          .locator(".transaction-page__fact")
          .filter({ has: page.locator("dt", { hasText: /^Trạng thái$/ }) }),
      ).toContainText(label);
      expect(
        await page.locator(".transaction-page__related-link").count(),
      ).toBeGreaterThan(0);
      await expect(
        page
          .locator(".transaction-page__fact")
          .filter({ has: page.locator("dt", { hasText: /^Ngày tạo$/ }) }),
      ).not.toContainText("—");
      passed(
        `${resource}: real code search, organization/state filters, exact state, history and links`,
      );
    }
    await page.screenshot({
      path: path.join(os.tmpdir(), "pbl6-admin-live-detail-final.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/admin/bookings", { waitUntil: "networkidle" });
    await page.locator("tbody tr").first().waitFor();
    await page.screenshot({
      path: path.join(os.tmpdir(), "pbl6-admin-live-mobile-final.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator(".admin-layout__account").click();
    const logoutResponse = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/v1/auth/logout",
    );
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    expect((await logoutResponse).status()).toBe(204);
    await page.waitForURL("**/login");
    expect(errors).toEqual([]);
    passed("Logout API and zero browser errors");
    fs.writeFileSync(
      path.join(os.tmpdir(), "pbl6-admin-live-verification.json"),
      JSON.stringify({ checks, errors }, null, 2),
    );
  } catch (error) {
    console.error("FAILED:", error.message);
    console.error("URL:", page.url());
    console.error("Login diagnostics:", loginEvents);
    console.error(
      "Visible alerts:",
      await page.locator("[role=alert]").allTextContents(),
    );
    throw error;
  } finally {
    await browser.close();
    cleanup();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
