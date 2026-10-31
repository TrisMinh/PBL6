import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { TASK9_CASES } from "./helpers/task9Cases";
import { AdminPage } from "./pages/AdminPage";

const before = process.env.TASK9_PHASE === "before";
test.use({ colorScheme: "light", reducedMotion: "reduce" });
for (const taskCase of TASK9_CASES) {
  test(`Task 9 ${taskCase.nodeId} ${taskCase.name}`, async ({ page }, info) => {
    test.skip(![360, 1440].includes(page.viewportSize()?.width ?? 0));
    if (info.project.name === "w1440")
      await page.setViewportSize({
        width: 1440,
        height: taskCase.height < 600 ? 900 : taskCase.height,
      });
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
    await page.goto(taskCase.url, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".admin-layout__main")).not.toBeEmpty();
    if (before && state !== "loading")
      await expect(page.locator(".admin-list-state--loading")).toHaveCount(0);
    if (!before) {
      if (state)
        await expect(
          page.locator(`.transaction-state--${state}`),
        ).toBeVisible();
      else if ("record" in taskCase)
        await expect(
          page.locator(".transaction-page__detail-body"),
        ).toBeVisible();
      else {
        await expect(
          page.getByRole("table", { includeHidden: true }).locator("tbody tr"),
        ).toHaveCount(taskCase.resource === "refunds" ? 6 : 10);
        if ("filter" in taskCase)
          await expect(page.getByRole("dialog")).toBeVisible();
      }
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((image) => image.decode()),
      );
    });
    await page.mouse.move(0, 0);
    if (before || process.env.TASK9_CAPTURE_ONLY === "1")
      await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: `docs/quality/evidence/task-9/${before ? "before" : "final"}/${taskCase.slug}-${info.project.name}.png`,
      });
    if (!before && process.env.TASK9_CAPTURE_ONLY === "1") {
      if ("filter" in taskCase)
        await page
          .getByRole("dialog")
          .screenshot({
            path: `docs/quality/evidence/task-9/final/${taskCase.slug}-dialog-${info.project.name}.png`,
          });
      const geometry = await page.evaluate(() => ({
        fonts: Array.from(document.fonts).map((font) => ({
          family: font.family,
          weight: font.weight,
          status: font.status,
        })),
        images: Array.from(document.images)
          .filter((image) => image.getBoundingClientRect().width > 0)
          .map((image) => ({
            className: image.className,
            alt: image.alt,
            source: image.getAttribute("src")?.slice(0, 160),
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            x: image.getBoundingClientRect().x,
            y: image.getBoundingClientRect().y,
            width: image.getBoundingClientRect().width,
            height: image.getBoundingClientRect().height,
          })),
      }));
      await writeFile(
        `.superpowers/sdd/2026-10-24-travel-v3-07-figma-fidelity-audit-remediation/task9-geometry-${taskCase.slug}-${info.project.name}.json`,
        JSON.stringify(
          { nodeId: taskCase.nodeId, url: taskCase.url, ...geometry },
          null,
          2,
        ),
      );
    }
    if (!before && process.env.TASK9_CAPTURE_ONLY !== "1")
      await expect(page).toHaveScreenshot(`task9-${taskCase.slug}.png`, {
        animations: "disabled",
        fullPage: true,
      });
  });
}
