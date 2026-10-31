import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";
import { AdminPage } from "./pages/AdminPage";

const EVIDENCE_DIR = "docs/quality/evidence/task-8";
const PHASE = process.env.TASK8_PHASE === "before" ? "before" : "final";

// Desktop evidence uses each exact Figma frame height, rather than the generic
// 900px functional viewport. Mobile dialogs capture the real 800px viewport.
function desktopFrameHeight(nodeId: string): number {
  if (["1185:61", "1185:834"].includes(nodeId)) return 1154;
  if (["1185:760", "1234:272"].includes(nodeId)) return 1098;
  if (["1186:764", "1236:312"].includes(nodeId)) return 1069;
  if (["1237:340", "1237:1218", "1238:414", "1238:545"].includes(nodeId))
    return 645;
  return 818;
}

import { TASK8_CASES, type Task8Case } from "./helpers/task8Cases";

test.use({ colorScheme: "light", reducedMotion: "reduce" });
test.beforeEach(({ viewport }) => {
  test.skip(
    ![360, 1440].includes(viewport?.width ?? 0),
    "Per-node visual evidence is 360 and exact 1440; all five widths have a separate responsive gate.",
  );
});

const PERSONAS: Readonly<Record<string, string>> = {
  "USR-0018": "Nguyễn Hoàng Long",
  "USR-0019": "Trần Thu Hà",
  "USR-0021": "Hoàng Nam",
  "USR-0024": "Lê Minh Anh",
  "USR-0031": "Phạm Ngọc Mai",
  "USR-0032": "Lê Minh Khang",
  "USR-0033": "Võ Thành Đạt",
  "USR-0034": "Bùi Khánh Linh",
  "USR-0035": "Đỗ Minh Anh",
  "USR-0036": "Hoàng Quốc Bảo",
  "USR-0037": "Ngô Lan Chi",
};
const PERSONA_ROLES: Readonly<Record<string, string>> = {
  "USR-0018": "OPERATOR_ADMIN",
  "USR-0019": "OPERATOR_SCHEDULER",
  "USR-0021": "DRIVER",
  "USR-0024": "PLATFORM_SUPPORT",
  "USR-0031": "OPERATOR_SCHEDULER",
  "USR-0032": "OPERATOR_SCHEDULER",
  "USR-0033": "OPERATOR_SCHEDULER",
  "USR-0034": "OPERATOR_SCHEDULER",
  "USR-0035": "OPERATOR_SCHEDULER",
  "USR-0036": "OPERATOR_SCHEDULER",
  "USR-0037": "OPERATOR_SCHEDULER",
};

async function assertCase(page: Page, taskCase: Task8Case): Promise<void> {
  const url = new URL(taskCase.url, "http://localhost");
  const staffId =
    url.searchParams.get("staffId") ??
    url.pathname.split("/").find((part) => part.startsWith("USR-"));
  const persona = staffId ? PERSONAS[staffId] : undefined;
  const dialog = url.searchParams.get("dialog");
  if (dialog === "create" || dialog === "create-member") {
    const name =
      taskCase.nodeId === "1185:834" ? "Thêm tổ chức" : "Thêm thành viên";
    await expect(page.getByRole("dialog", { name })).toBeVisible();
    if (name === "Thêm tổ chức")
      await expect(page.getByLabel("Mã số thuế")).toBeVisible();
    else await expect(page.getByLabel("Vai trò")).toBeVisible();
  } else if (dialog === "edit" || dialog === "edit-member") {
    const modal = page.getByRole("dialog", { name: "Chỉnh sửa thông tin" });
    await expect(modal).toBeVisible();
    if (persona) await expect(modal.getByText(persona)).toBeVisible();
    await expect(modal.getByLabel("Vai trò")).toBeVisible();
    if (staffId)
      await expect(modal.getByLabel("Vai trò")).toHaveValue(
        PERSONA_ROLES[staffId],
      );
  } else if (persona) {
    await expect(page.getByText(persona).first()).toBeVisible();
    await expect(page.getByText(staffId ?? "").first()).toBeVisible();
    if (staffId)
      await expect(
        page.locator(".staff-page__membership-table tbody td").nth(1),
      ).toContainText(PERSONA_ROLES[staffId]);
  } else if (taskCase.nodeId === "1185:760") {
    await expect(page.getByText("0312345678")).toBeVisible();
  } else {
    await expect(
      page.getByRole("table").first().locator("tbody tr"),
    ).toHaveCount(10);
  }
}

async function ready(page: Page): Promise<void> {
  await expect(page.locator(".admin-layout")).toBeVisible();
  await expect(page.locator(".admin-layout__main")).not.toBeEmpty();
  await expect(
    page
      .locator(
        ".admin-layout__main :is(h1, .admin-list-state--empty, .admin-list-state--error)",
      )
      .first(),
  ).toBeVisible();
  await expect(page.locator(".admin-list-state--loading")).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
      ),
    );
  });
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  slug: string,
  isDialog: boolean,
): Promise<void> {
  await ready(page);
  await assertNoPageOverflow(page);
  await page.mouse.move(0, 0);
  const fullPage = !isDialog || testInfo.project.name === "w1440";
  const writesEvidence =
    PHASE === "before" || process.env.TASK8_CAPTURE_ONLY === "1";
  // Keep normal regression runs read-only: changing evidence JSON under Vite's
  // watched project can reload unrelated pages during keyboard/axe assertions.
  if (writesEvidence)
    await page.screenshot({
      animations: "disabled",
      fullPage,
      path: `${EVIDENCE_DIR}/${PHASE}/${slug}-${testInfo.project.name}.png`,
    });
  if (PHASE === "final" && writesEvidence) {
    const assets = await page.locator("img, select").evaluateAll((elements) =>
      elements.flatMap((element) => {
        if (element instanceof HTMLSelectElement) {
          const box = element.getBoundingClientRect();
          const css = getComputedStyle(element);
          if (!box.width || !box.height || css.backgroundImage === "none")
            return [];
          return [
            {
              source: css.backgroundImage,
              className: element.className,
              intrinsicWidth: 16,
              intrinsicHeight: 16,
              x: box.right - 28,
              y: box.y + (box.height - 16) / 2,
              width: 16,
              height: 16,
            },
          ];
        }
        if (!(element instanceof HTMLImageElement)) return [];
        const box = element.getBoundingClientRect();
        if (
          !box.width ||
          !box.height ||
          getComputedStyle(element).visibility === "hidden"
        )
          return [];
        return [
          {
            source: element.getAttribute("src"),
            className: element.className,
            intrinsicWidth: element.naturalWidth,
            intrinsicHeight: element.naturalHeight,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          },
        ];
      }),
    );
    await writeFile(
      `${EVIDENCE_DIR}/final/${slug}-${testInfo.project.name}-assets.json`,
      JSON.stringify(assets, null, 2),
    );
  }
  if (PHASE === "final" && process.env.TASK8_CAPTURE_ONLY !== "1")
    await expect(page).toHaveScreenshot(`task8-${slug}.png`, {
      animations: "disabled",
      fullPage,
    });
}

for (const taskCase of TASK8_CASES) {
  test(`Task 8 ${taskCase.nodeId} ${taskCase.slug}`, async ({
    page,
  }, testInfo) => {
    const admin = new AdminPage(page);
    if (PHASE === "final" && testInfo.project.name === "w1440")
      await page.setViewportSize({
        width: 1440,
        height: desktopFrameHeight(taskCase.nodeId),
      });
    await admin.login();
    await page.goto(taskCase.url, { waitUntil: "domcontentloaded" });
    if (PHASE === "final") {
      await ready(page);
      await assertCase(page, taskCase);
    }
    await capture(
      page,
      testInfo,
      taskCase.slug,
      taskCase.url.includes("dialog="),
    );
  });
}
