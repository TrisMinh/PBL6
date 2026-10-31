import { expect, type Page } from "@playwright/test";

interface OverflowMeasurement {
  client: number;
  offenders: string[];
  scroll: number;
}

export async function assertNoPageOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate<OverflowMeasurement>(() => {
    const root = document.documentElement;
    const tolerance = 1;
    const offenders = Array.from(document.querySelectorAll("body *"))
      .filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        if (element.closest(".seat-map__scroller, .admin-table__scroller"))
          return false;
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          bounds.width > 0 &&
          bounds.height > 0;
        return (
          visible &&
          (bounds.left < -tolerance ||
            bounds.right > root.clientWidth + tolerance)
        );
      })
      .slice(0, 10)
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        const classes = Array.from(element.classList).join(".");
        const selector = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${classes ? `.${classes}` : ""}`;
        return `${selector} [left=${bounds.left.toFixed(1)}, right=${bounds.right.toFixed(1)}, width=${bounds.width.toFixed(1)}]`;
      });
    return { client: root.clientWidth, offenders, scroll: root.scrollWidth };
  });
  const diagnostic =
    sizes.offenders.length > 0 ? sizes.offenders.join("; ") : "none detected";
  expect(
    sizes.scroll,
    `Document overflow: scroll=${sizes.scroll}, client=${sizes.client}. Visible offenders: ${diagnostic}`,
  ).toBeLessThanOrEqual(sizes.client + 1);
}
