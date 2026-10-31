import { expect, test } from "@playwright/test";
import { TASK9_CASES } from "./helpers/task9Cases";
import { TASK9_STATE_ASSERTIONS } from "./helpers/task9Assertions";
import { AdminPage } from "./pages/AdminPage";

test.use({ colorScheme: "light", reducedMotion: "reduce" });
for (const taskCase of TASK9_CASES.filter((item) => "state" in item)) {
  test(`Task9 state ${taskCase.nodeId} ${taskCase.name}`, async ({ page }) => {
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
          if (!url.includes(`/api/v1/admin/${resource}`))
            return original(input, init);
          if (state === "loading")
            return new Promise<Response>(() => undefined);
          const headers = new Headers(
            init?.headers ??
              (input instanceof Request ? input.headers : undefined),
          );
          if (state) headers.set("x-mock-scenario", state);
          return original(input, { ...init, headers });
        };
      },
      { resource: taskCase.resource, state },
    );
    await new AdminPage(page).login();
    await page.goto(taskCase.url);
    const main = page.getByRole("main");
    for (const literal of TASK9_STATE_ASSERTIONS[taskCase.nodeId] ?? [])
      await expect(
        main.getByText(literal, { exact: true }).first(),
      ).toBeVisible();
    if (state === "error")
      await expect(
        main.getByRole("button", { name: "Thử lại", exact: true }),
      ).toBeVisible();
    if (state === "forbidden" || state === "not-found")
      await expect(
        main.getByRole("button", { name: "Thử lại", exact: true }),
      ).toHaveCount(0);
    if (page.viewportSize()?.width === 1440)
      expect(
        (await main.locator(".transaction-state").boundingBox())?.height,
      ).toBe(300);
  });
}
