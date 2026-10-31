import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { AdminPage } from "./pages/AdminPage";
import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";
import { TASK9_CASES } from "./helpers/task9Cases";

test.use({ colorScheme: "light", reducedMotion: "reduce" });
for (const taskCase of TASK9_CASES) {
  test(`Task9 responsive and accessibility ${taskCase.nodeId}`, async ({
    page,
  }) => {
    const state = "state" in taskCase ? taskCase.state : undefined;
    await page.addInitScript(
      ({ resource, state }) => {
        const original = window.fetch.bind(window);
        window.fetch = (input, init) => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          if (!state || !url.includes(`/api/v1/admin/${resource}`))
            return original(input, init);
          if (state === "loading")
            return new Promise<Response>(() => undefined);
          const headers = new Headers(
            init?.headers ??
              (input instanceof Request ? input.headers : undefined),
          );
          headers.set("x-mock-scenario", state);
          return original(input, { ...init, headers });
        };
      },
      { resource: taskCase.resource, state },
    );
    await new AdminPage(page).login();
    await page.goto(taskCase.url);
    if (!("filter" in taskCase))
      await expect(page.getByRole("main")).toHaveCount(1);
    if (state)
      await expect(page.locator(`.transaction-state--${state}`)).toBeVisible();
    else if ("record" in taskCase)
      await expect(
        page.locator(".transaction-page__detail-body"),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("table", { includeHidden: true }).locator("tbody tr"),
      ).toHaveCount(taskCase.resource === "refunds" ? 6 : 10);
    await assertNoPageOverflow(page);
    if ("filter" in taskCase) {
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
      await dialog.getByRole("button", { name: "Đóng", exact: true }).focus();
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
    }
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    if ("filter" in taskCase) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });
}
