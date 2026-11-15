import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface HeaderSnapshot {
  outer: Record<string, number>;
  controls: {
    text: string | undefined;
    rect: Record<string, number>;
    font: string;
    size: string;
    lineHeight: string;
  }[];
}
async function headerGeometry(page: Page): Promise<HeaderSnapshot> {
  await page.evaluate(() => document.fonts.ready);
  return page.locator(".customer-layout__header").evaluate((header) => ({
    outer: header.getBoundingClientRect().toJSON(),
    controls: [
      ...header.querySelectorAll(
        ".customer-layout__logo,.customer-layout__desktop-nav a,.customer-layout__journey-link,.customer-layout__login-link,.customer-layout__booking-link",
      ),
    ].map((node) => ({
      text: node.textContent?.trim(),
      rect: node.getBoundingClientRect().toJSON(),
      font: getComputedStyle(node).fontFamily,
      size: getComputedStyle(node).fontSize,
      lineHeight: getComputedStyle(node).lineHeight,
    })),
  }));
}

test("customer header stays in place through real navigation and back/forward", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop header");
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fontRequests: string[] = [];
  page.on("request", (req) => {
    if (/fonts\.googleapis|fonts\.gstatic/.test(req.url()))
      fontRequests.push(req.url());
  });
  const out = info.outputPath("navigation");
  await mkdir(out, { recursive: true });
  await page.goto("/");
  await expect(page.getByTestId("home-heading")).toBeVisible();
  const baseline = await headerGeometry(page);
  const rows = [];
  const nav = page.getByRole("navigation", {
    name: "Điều hướng chính",
    exact: true,
  });
  for (const [index, label] of [
    "Khám phá",
    "Tìm chuyến",
    "Mở bán vé",
    "Tra cứu vé",
    "Trang chủ",
    "Khám phá",
    "Trang chủ",
    "Tra cứu vé",
    "Khám phá",
  ].entries()) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    const paths: Record<string, string> = {
      "Khám phá": "/explore",
      "Tìm chuyến": "/trips",
      "Mở bán vé": "/partners",
      "Tra cứu vé": "/tickets/lookup",
      "Trang chủ": "/",
    };
    await expect.poll(() => new URL(page.url()).pathname).toBe(paths[label]);
    await expect(
      nav.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.mouse.move(0, 0);
    const current = await headerGeometry(page);
    expect(current, `header after clicking ${label}`).toEqual(baseline);
    const styles = await nav
      .locator(".customer-layout__nav-label")
      .evaluateAll((labels) =>
        labels.map((text) => {
          const underline = getComputedStyle(text, "::after");
          return {
            label: text.textContent,
            fontWeight: getComputedStyle(text).fontWeight,
            hasUnderline:
              underline.content === '""' && underline.height === "2px",
          };
        }),
      );
    for (const style of styles) {
      const active = style.label === label;
      expect(style.fontWeight).toBe("600");
      expect(style.hasUnderline).toBe(active);
    }
    rows.push({ label, url: page.url(), ...current });
    await page.screenshot({ path: resolve(out, `${index}-${label}.png`) });
  }
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/tickets/lookup");
  await page.mouse.move(0, 0);
  expect(await headerGeometry(page)).toEqual(baseline);
  await page.goForward();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/explore");
  await page.mouse.move(0, 0);
  expect(await headerGeometry(page)).toEqual(baseline);
  await page.reload();
  expect(await headerGeometry(page)).toEqual(baseline);
  expect(fontRequests).toEqual([]);
  await writeFile(
    resolve(out, "navigation.json"),
    JSON.stringify(rows, null, 2),
  );

  await page.goto("/");
  const header = page.getByRole("banner");
  const login = header.getByRole("link", { name: "Đăng nhập", exact: true });
  await expect(login).toBeVisible();
  for (const width of [1024, 1200, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const { gaps, rightClearance } = await header.evaluate((element) => {
      const labels = [
        ...element.querySelectorAll(".customer-layout__nav-label"),
      ].map((node) => node.getBoundingClientRect());
      const actions = element.querySelector(".customer-layout__actions");
      if (!actions || labels.length !== 5)
        throw new Error("Missing customer header controls");
      return {
        gaps: labels
          .slice(1)
          .map((label, index) => label.left - labels[index].right),
        rightClearance:
          actions.getBoundingClientRect().left -
          labels[labels.length - 1].right,
      };
    });
    expect(gaps).toEqual([30, 30, 30, 30]);
    expect(rightClearance).toBeGreaterThan(0);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await header.screenshot({ path: info.outputPath("header-login.png") });
  await login.click();
  await expect(page).toHaveURL(/\/login$/);
});
