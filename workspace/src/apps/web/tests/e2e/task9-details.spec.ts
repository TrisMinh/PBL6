import { expect, test } from "@playwright/test";
import { TASK9_CASES } from "./helpers/task9Cases";
import { TASK9_DETAIL_ASSERTIONS } from "./helpers/task9Assertions";
import { AdminPage } from "./pages/AdminPage";

test.use({ colorScheme: "light", reducedMotion: "reduce" });
for (const taskCase of TASK9_CASES.filter((item) => "record" in item)) {
  test(`Task9 detail ${taskCase.nodeId} ${taskCase.name}`, async ({ page }) => {
    await new AdminPage(page).login();
    await page.goto(taskCase.url);
    const main = page.getByRole("main");
    for (const literal of TASK9_DETAIL_ASSERTIONS[taskCase.nodeId] ?? [])
      await expect(
        main.getByText(literal, { exact: true }).first(),
      ).toBeVisible();
    await expect(
      main.getByRole("link", { name: "Quay lại danh sách", exact: true }),
    ).toHaveAttribute("href", `/admin/${taskCase.resource}`);
    if (page.viewportSize()?.width === 1440) {
      const cards = main.locator(".transaction-page__detail-grid > article");
      expect((await cards.nth(0).boundingBox())?.width).toBe(688);
      expect((await cards.nth(1).boundingBox())?.width).toBe(448);
    }
  });
}
