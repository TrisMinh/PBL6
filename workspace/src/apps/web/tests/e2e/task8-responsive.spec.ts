import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { AdminPage } from "./pages/AdminPage";
import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";
import { TASK8_CASES } from "./helpers/task8Cases";

test.use({ colorScheme: "light", reducedMotion: "reduce" });
for (const { url, nodeId } of TASK8_CASES) {
  test(`Task 8 responsive ${nodeId} ${url}`, async ({ page }) => {
    await new AdminPage(page).login();
    await page.goto(url);
    await expect(page.locator(".admin-list-state--loading")).toHaveCount(0);
    await expect(page.locator(".admin-layout__main")).not.toBeEmpty();
    await expect(page.locator(".admin-layout__main h1")).toBeVisible();
    if (url.includes("dialog="))
      await expect(page.getByRole("dialog")).toBeVisible();
    await assertNoPageOverflow(page);
    if (url.includes("dialog=")) {
      const modal = page.getByRole("dialog");
      expect(
        await modal.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
      const modalBox = await modal.boundingBox();
      for (const control of await modal
        .locator("form input, form select, form textarea, form button")
        .all()) {
        const box = await control.boundingBox();
        if (!box || !modalBox) continue;
        expect(box.x).toBeGreaterThanOrEqual(modalBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(
          modalBox.x + modalBox.width,
        );
      }
    }
    if ((page.viewportSize()?.width ?? 1440) < 768 && url === "/admin/staff") {
      const row = page.getByRole("table").locator("tbody tr").first();
      const rowBox = await row.boundingBox();
      const actionBox = await row
        .getByRole("link", { name: "Xem chi tiết" })
        .boundingBox();
      expect(actionBox?.y ?? Infinity).toBeLessThan(
        (rowBox?.y ?? 0) + (rowBox?.height ?? 0),
      );
      await expect(
        row.getByRole("link", { name: "Nguyễn Hoàng Long", exact: true }),
      ).toBeInViewport();
    }
    if (
      (page.viewportSize()?.width ?? 1440) < 768 &&
      url.includes("view=members")
    ) {
      for (const row of await page
        .locator(".organization-page__members tbody tr")
        .all()) {
        const rowBox = await row.boundingBox();
        for (const cell of await row.locator("td").all()) {
          const box = await cell.boundingBox();
          if (box && rowBox)
            expect(box.y + box.height).toBeLessThanOrEqual(
              rowBox.y + rowBox.height,
            );
        }
      }
    }
    const failures = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(failures.violations).toEqual([]);
    if (url.includes("dialog=")) {
      const modal = page.getByRole("dialog");
      await modal.getByRole("button", { name: "Đóng hộp thoại" }).focus();
      await page.keyboard.press("Tab");
      await expect
        .poll(() =>
          modal.evaluate((element) => element.contains(document.activeElement)),
        )
        .toBe(true);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page).not.toHaveURL(/dialog=/);
    }
  });
}
