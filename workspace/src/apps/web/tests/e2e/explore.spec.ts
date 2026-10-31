import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";
import { ExplorePage } from "./pages/ExplorePage";

test.use({ colorScheme: "light", reducedMotion: "reduce" });
async function quality(page: Page): Promise<void> {
  await assertNoPageOverflow(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}
async function capture(
  page: Page,
  name: string,
  project: string,
): Promise<void> {
  if (!["w360", "w1440"].includes(project)) return;
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.screenshot({
    path: `docs/quality/evidence/explore/${name}-${project}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
test("Explore province search, keyboard detail, back and direct links", async ({
  page,
}, info) => {
  const explore = new ExplorePage(page);
  await explore.goto();
  await explore.ready();
  await explore.expectActive("Khám phá");
  await quality(page);
  await capture(page, "provinces", info.project.name);
  await explore.search("lam dong");
  await expect(
    page.getByRole("link", { name: /Xem điểm đón, trả/ }),
  ).toHaveCount(1);
  await explore.province("Lâm Đồng").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/explore\/lam-dong$/);
  await expect(
    page.getByRole("heading", { name: "Lâm Đồng", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Điểm đón", exact: true })
      .getByRole("article"),
  ).toHaveCount(2);
  await expect(
    page
      .getByRole("region", { name: "Điểm trả", exact: true })
      .getByRole("article"),
  ).toHaveCount(2);
  await explore.expectActive("Khám phá");
  await quality(page);
  await capture(page, "lam-dong", info.project.name);
  await page
    .getByRole("link", { name: "Tất cả tỉnh, thành", exact: true })
    .click();
  await explore.ready();
  await explore.goto("/explore/da-nang");
  await expect(
    page.getByRole("heading", { name: "Đà Nẵng", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Đà Nẵng", exact: true }),
  ).toBeVisible();
});
test("Customer navigation has one pathname-owned active item", async ({
  page,
}) => {
  const explore = new ExplorePage(page);
  for (const [url, label] of [
    ["/", "Trang chủ"],
    ["/trips", "Điểm đến"],
    ["/explore", "Khám phá"],
    ["/explore/lam-dong", "Khám phá"],
    ["/tickets/lookup", "Vé xe"],
  ]) {
    await explore.goto(url);
    await explore.expectActive(label);
  }
});
test("Explore loading, service retry, empty and unknown province recovery", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const state = sessionStorage.getItem("explore-e2e-scenario");
      if (!state || !url.includes("/api/v1/explore/"))
        return original(input, init);
      if (state === "pending") return new Promise<Response>(() => undefined);
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      headers.set("x-mock-scenario", state);
      return original(input, { ...init, headers });
    };
  });
  const explore = new ExplorePage(page);
  await explore.goto();
  await explore.ready();
  await explore.scenario("pending");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Đang tải");
  await capture(page, "loading", info.project.name);
  await explore.scenario("error");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Chưa tải được dữ liệu" }),
  ).toBeVisible();
  await quality(page);
  await capture(page, "error", info.project.name);
  await explore.scenario("");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await explore.ready();
  await explore.scenario("empty");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Chưa có tỉnh, thành để hiển thị" }),
  ).toBeVisible();
  await quality(page);
  await capture(page, "empty", info.project.name);
  await explore.scenario("");
  await explore.goto("/explore/unknown-province");
  await expect(
    page.getByRole("heading", {
      name: "Không tìm thấy tỉnh, thành",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toHaveCount(0);
  await quality(page);
  await capture(page, "not-found", info.project.name);
  await page.getByRole("link", { name: "Về Khám phá", exact: true }).click();
  await explore.ready();
});
