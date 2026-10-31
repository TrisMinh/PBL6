import { expect, test } from "@playwright/test";

import { AdminPage } from "./pages/AdminPage";

test.beforeEach(({ viewport }) => {
  test.skip(
    viewport?.width !== 1440,
    "Exact 1440 Figma geometry; responsive behavior has its own five-width gate.",
  );
});

test("Task 8 organization regions retain exact desktop hierarchy and geometry", async ({
  page,
}) => {
  await new AdminPage(page).login();
  const hero = page.locator(".organization-page__hero");
  await expect(hero).toBeVisible();
  expect(await hero.boundingBox()).toMatchObject({
    x: 144,
    y: 116,
    width: 1152,
    height: 184,
  });
  await expect(
    page.getByRole("heading", { name: "Danh sách tổ chức" }),
  ).toHaveCSS("font-size", "20px");
  const table = page.getByRole("table", { name: "Danh sách tổ chức" });
  const labelX = await table
    .locator("th")
    .nth(1)
    .evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().x;
    });
  expect(labelX).toBeCloseTo(431.5, 0);
  expect(
    (await page.locator(".organization-page__eyebrow").boundingBox())?.y,
  ).toBe(147.5);
  expect(
    (await page.locator(".admin-layout__account").boundingBox())?.width,
  ).toBe(124);
  await page.goto("/admin/organizations/ORG-001");
  await expect(
    page.getByRole("heading", { name: "Thông tin pháp lý" }),
  ).toBeVisible();
  expect(
    (await page.locator(".organization-page__detail-grid").boundingBox())?.y,
  ).toBe(384);
  expect(
    (await page.locator(".organization-page__panel").boundingBox())?.height,
  ).toBe(378);
  await expect(page.locator(".organization-page__panel")).toHaveCSS(
    "box-shadow",
    "none",
  );
  await expect(
    page.getByRole("button", { name: "Chỉnh sửa", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await page
        .locator(".organization-page__detail-card")
        .first()
        .boundingBox()
    )?.height,
  ).toBe(284);
  expect(
    (
      await page
        .locator(".organization-page__members tbody tr")
        .first()
        .boundingBox()
    )?.height,
  ).toBe(76);
});

test("Task 8 membership dialog preserves exact field geometry and fixed organization identity", async ({
  page,
}) => {
  await new AdminPage(page).login();
  await page.goto("/admin/staff/USR-0018?dialog=edit");
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await expect(
    page.locator(".staff-page__membership-actions .button"),
  ).toHaveText("Gán vai trò");
  await expect(
    modal.getByText("BlueLine Co. · ORG-001", { exact: true }),
  ).toBeVisible();
  expect((await modal.boundingBox())?.height).toBe(469);
  expect((await modal.getByLabel("Lý do thay đổi").boundingBox())?.height).toBe(
    48,
  );
  await modal.click({ position: { x: 30, y: 20 } });
  await expect(modal).toHaveCSS("outline-color", "rgba(0, 0, 0, 0)");
  await page.keyboard.press("Tab");
  await expect(modal.getByRole("button", { name: "Đóng hộp thoại" })).toHaveCSS(
    "outline-style",
    "solid",
  );
});

test("Task 8 organization frame contains the exact first record", async ({
  page,
}) => {
  await new AdminPage(page).login();
  await expect(page.getByText("BlueLine Co.")).toBeVisible();
  await expect(page.getByText("ORG-001")).toBeVisible();
});

test("Task 8 list and legal card retain exact semantic color roles", async ({
  page,
}) => {
  await new AdminPage(page).login();
  await expect
    .soft(page.getByRole("columnheader", { name: "Mã tổ chức" }))
    .toHaveCSS("color", "rgb(95, 115, 138)");
  await expect
    .soft(page.locator(".organization-page__status--inactive"))
    .toHaveCSS("background-color", "rgb(240, 242, 247)");
  await page.goto("/admin/organizations/ORG-001");
  await expect
    .soft(page.getByRole("heading", { name: "Thông tin pháp lý" }))
    .toHaveCSS("color", "rgb(26, 48, 77)");
});

test("Task 8 organization create dialog has Figma desktop width", async ({
  page,
}) => {
  await new AdminPage(page).login();
  await page.goto("/admin/organizations?dialog=create");
  const dialog = page.getByRole("dialog", { name: "Thêm tổ chức" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box?.width).toBe(720);
  expect(box?.height).toBe(426);
  expect((await dialog.getByLabel("Tên pháp lý").boundingBox())?.height).toBe(
    48,
  );
});

test("Task 8 staff cards keep exact readable desktop typography and row rhythm", async ({
  page,
}) => {
  await new AdminPage(page).login();
  await page.goto("/admin/staff");
  await expect(
    page.getByRole("heading", { name: "Danh sách nhân viên" }),
  ).toHaveCSS("font-size", "20px");
  expect(
    (await page.locator(".staff-page__title-row").boundingBox())?.height,
  ).toBe(40);
  await expect(page.getByLabel("Nhà xe")).toHaveValue("");
  await expect(page.getByLabel("Nhà xe").locator("option:checked")).toHaveText(
    "Tất cả nhà xe",
  );
  expect(
    (await page.getByRole("table").locator("tbody tr").first().boundingBox())
      ?.height,
  ).toBe(56);
  await page.goto("/admin/staff/USR-0018");
  await expect(
    page.getByRole("heading", { name: "Thông tin tài khoản" }),
  ).toHaveCSS("font-size", "20px");
  await expect(page.locator(".staff-page__detail-card dd").first()).toHaveCSS(
    "font-size",
    "14px",
  );
  expect(
    (await page.locator(".staff-page__detail-card").nth(1).boundingBox())
      ?.height,
  ).toBe(297);
  expect(
    (
      await page
        .locator(".staff-page__membership-actions .button")
        .boundingBox()
    )?.width,
  ).toBe(200);
});

test("Task 8 staff detail owns edit dialog in the URL", async ({ page }) => {
  await new AdminPage(page).login();
  await page.goto("/admin/staff/USR-0018?dialog=edit");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Nguyễn Hoàng Long"),
  ).toBeVisible();
});

test("Task 8 organization members preserves status filter and keyboard dialog return", async ({
  page,
}) => {
  await new AdminPage(page).login();
  await page.goto("/admin/organizations/ORG-001?view=members");
  const status = page.getByLabel("Trạng thái", { exact: true });
  await expect(status).toHaveValue("active");
  expect(
    (await page.locator(".organization-page__panel").boundingBox())?.height,
  ).toBe(410);
  await status.selectOption("inactive");
  await expect(page).toHaveURL(/status=inactive/);
  await expect(
    page.locator(".organization-page__members tbody tr"),
  ).toHaveCount(0);
  await status.selectOption("active");
  const trigger = page.getByRole("button", {
    name: "Thêm thành viên",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("Task 8 platform support keeps its exact149px role action", async ({
  page,
}) => {
  await new AdminPage(page).login();
  await page.goto("/admin/staff/USR-0024");
  const action = page.locator(".staff-page__membership-actions .button");
  await expect(action).toBeVisible();
  expect((await action.boundingBox())?.width).toBeCloseTo(149, 0);
});
