import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";
import { TicketPage } from "./pages/TicketPage";

const EVIDENCE_DIR = "docs/quality/evidence/task-7";
const PHASE = process.env.TASK7_PHASE === "final" ? "final" : "before";

type Selection = "a01" | "a02" | "both" | "none";

test.use({ colorScheme: "light", reducedMotion: "reduce" });

async function prepare(page: Page): Promise<void> {
  await page.clock.install({ time: new Date("2026-10-23T08:00:00+07:00") });
  await page.clock.setFixedTime(new Date("2026-10-23T08:00:00+07:00"));
  const ticket = new TicketPage(page);
  const bookingCode = await ticket.issued({
    a01: "Nguyễn Minh Anh",
    a02: "Trần Gia Huy",
  });
  await ticket.requireLookup();
  await ticket.lookup(bookingCode);
  await ticket.expectIssued("Nguyễn Minh Anh");
  await page.getByRole("link", { name: "Hủy vé", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn vé cần hủy", exact: true }),
  ).toBeVisible();
}

async function choose(page: Page, selection: Selection): Promise<void> {
  const choices = page.getByRole("checkbox");
  if (selection === "a01" || selection === "both") await choices.nth(0).check();
  if (selection === "a02" || selection === "both") await choices.nth(1).check();
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  slug: string,
): Promise<void> {
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
  await assertNoPageOverflow(page);
  await page.mouse.move(0, 0);
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: `${EVIDENCE_DIR}/${PHASE}/${slug}-${testInfo.project.name}.png`,
  });
  if (PHASE === "final")
    await expect(page).toHaveScreenshot(`task7-${slug}.png`, {
      animations: "disabled",
      fullPage: true,
    });
}

async function expectBox(
  locator: Locator,
  expected: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  for (const key of ["x", "y", "width", "height"] as const)
    expect(
      Math.abs((box?.[key] ?? 0) - expected[key]),
      key,
    ).toBeLessThanOrEqual(2);
}

async function expectBelow(upper: Locator, lower: Locator): Promise<void> {
  const [upperBox, lowerBox] = await Promise.all([
    upper.boundingBox(),
    lower.boundingBox(),
  ]);
  expect(upperBox).not.toBeNull();
  expect(lowerBox).not.toBeNull();
  expect(lowerBox?.y ?? 0).toBeGreaterThanOrEqual(
    (upperBox?.y ?? 0) + (upperBox?.height ?? 0),
  );
}

async function rowOutline(row: Locator): Promise<{
  style: string;
  width: string;
}> {
  return row.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
}

test("Task 7 ticket focus follows input modality", async ({ page }) => {
  await prepare(page);
  const choices = page.getByRole("checkbox");
  const firstRow = choices.nth(0).locator("..");
  const secondRow = choices.nth(1).locator("..");

  await choices.nth(0).check();
  await expect
    .poll(async () => (await rowOutline(firstRow)).style)
    .toBe("none");

  await page.keyboard.press("Tab");
  await expect(choices.nth(1)).toBeFocused();
  await expect
    .poll(() => rowOutline(secondRow))
    .toEqual({
      style: "solid",
      width: "3px",
    });
});

for (const selection of ["both", "a01", "a02", "none"] as const) {
  test(`Task 7 selection ${selection}`, async ({ page }, testInfo) => {
    await prepare(page);
    await choose(page, selection);
    const expectedCount =
      selection === "both" ? 2 : selection === "none" ? 0 : 1;
    await expect(
      page.getByText(`Đã chọn ${expectedCount} / 2 vé`),
    ).toBeVisible();
    const checks = page.getByRole("checkbox");
    await expect(checks.nth(0)).toBeChecked({
      checked: selection === "a01" || selection === "both",
    });
    await expect(checks.nth(1)).toBeChecked({
      checked: selection === "a02" || selection === "both",
    });
    await expect(
      page.getByText("Nguyễn Minh Anh", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Trần Gia Huy", { exact: true })).toBeVisible();
    if (testInfo.project.name === "w1440") {
      await expectBox(page.locator(".cancellation-page__review-panel"), {
        x: 80,
        y: 230,
        width: 820,
        height: 720,
      });
      await expectBox(page.locator(".cancellation-page__summary"), {
        x: 930,
        y: 230,
        width: 430,
        height: 720,
      });
    } else
      await expectBelow(
        page.locator(".cancellation-page__review-panel"),
        page.locator(".cancellation-page__summary"),
      );
    await capture(page, testInfo, `selection-${selection}`);
  });
}

for (const selection of ["a01", "a02"] as const) {
  test(`Task 7 confirmation ${selection}`, async ({ page }, testInfo) => {
    await prepare(page);
    await choose(page, selection);
    await page.getByRole("button", { name: "Xem phí và tiền hoàn" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const expectedName =
      selection === "a01" ? "Nguyễn Minh Anh" : "Trần Gia Huy";
    const excludedName =
      selection === "a01" ? "Trần Gia Huy" : "Nguyễn Minh Anh";
    await expect(
      page.getByRole("dialog").getByText(expectedName, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog").getByText(excludedName, { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("dialog")).toContainText("288.000đ");
    if (testInfo.project.name === "w1440") {
      await expectBox(
        page.getByRole("dialog").locator(".cancellation-page__review-panel"),
        {
          x: 80,
          y: 230,
          width: 820,
          height: 720,
        },
      );
      await expectBox(
        page.getByRole("dialog").locator(".cancellation-page__summary"),
        {
          x: 930,
          y: 230,
          width: 430,
          height: 720,
        },
      );
    }
    await capture(page, testInfo, `confirmation-${selection}`);
  });
}

for (const selection of ["both", "a01", "a02"] as const) {
  test(`Task 7 processing ${selection}`, async ({ page }, testInfo) => {
    await prepare(page);
    await choose(page, selection);
    await page.getByRole("button", { name: "Xem phí và tiền hoàn" }).click();
    const dialog = page.getByRole("dialog");
    const count = selection === "both" ? 2 : 1;
    await dialog
      .getByRole("button", { name: `Xác nhận hủy ${count} vé` })
      .click();
    await expect(
      page.getByRole("heading", { name: "Theo dõi hoàn tiền" }),
    ).toBeVisible();
    const expectedSeats =
      selection === "both" ? "A01, A02" : selection === "a01" ? "A01" : "A02";
    const expectedAmount = selection === "both" ? "₫576.000" : "₫288.000";
    await expect(page.getByText(expectedAmount, { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        `Vé ${expectedSeats} đã hủy; hoàn tiền được theo dõi độc lập.`,
        { exact: true },
      ),
    ).toBeVisible();
    if (testInfo.project.name === "w1440")
      await expectBox(page.locator(".cancellation-page__refund"), {
        x: 160,
        y: 230,
        width: 1120,
        height: 520,
      });
    await capture(page, testInfo, `processing-${selection}`);
  });
}
