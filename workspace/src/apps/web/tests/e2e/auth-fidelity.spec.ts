import { expect, test, type Page } from "@playwright/test";

import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";

const AUTH_CASES = [
  {
    route: "/login",
    slug: "login",
    heading: "Hành trình đang chờ bạn",
    controlSelector: ".auth-page__control--identity",
    controlRight: 670,
    verticalGeometry: [
      { selector: ".auth-page__assistant > img", y: 310, height: 106 },
      { selector: ".auth-page__eyebrow", y: 414, tolerance: 2 },
      { selector: ".auth-page__title", y: 438, tolerance: 2 },
      { selector: ".auth-page__providers", y: 514, height: 46 },
      {
        selector: 'input[name="email"]',
        y: 608,
        height: 46,
      },
      { selector: 'input[name="password"]', y: 672, height: 46 },
      {
        selector: 'form .auth-page__fields > button[type="submit"]',
        y: 766,
        height: 52,
      },
    ],
  },
  {
    route: "/register",
    slug: "register",
    heading: "Tạo tài khoản BLUE.",
    controlSelector: ".auth-page__control--name",
    controlRight: 432,
    verticalGeometry: [
      { selector: ".auth-page__assistant > img", y: 304, height: 106 },
      { selector: ".auth-page__eyebrow", y: 408, tolerance: 2 },
      { selector: ".auth-page__title", y: 432, tolerance: 2 },
      { selector: 'input[name="fullName"]', y: 532, height: 52 },
      { selector: 'input[name="phone"]', y: 532, height: 52 },
      { selector: 'input[name="email"]', y: 614, height: 52 },
      { selector: 'input[name="password"]', y: 696, height: 52 },
      {
        selector: 'input[name="confirmPassword"]',
        y: 696,
        height: 52,
      },
      {
        selector: 'form .auth-page__fields > button[type="submit"]',
        y: 820,
        height: 52,
      },
    ],
  },
  {
    route: "/forgot-password",
    slug: "forgot",
    heading: "Quên mật khẩu?",
    controlSelector: ".auth-page__control--identity",
    controlRight: 670,
    verticalGeometry: [
      { selector: ".auth-page__assistant > img", y: 322, height: 106 },
      { selector: ".auth-page__eyebrow", y: 430, tolerance: 2 },
      { selector: ".auth-page__title", y: 454, tolerance: 2 },
      { selector: 'input[name="email"]', y: 578, height: 52 },
      {
        selector: 'form .auth-page__fields > button[type="submit"]',
        y: 648,
        height: 52,
      },
      { selector: ".auth-page__recovery-steps", y: 796, height: 76 },
      {
        selector: ".auth-page__back-login",
        y: 896,
        height: 44,
        tolerance: 2,
      },
    ],
  },
] as const;

async function expectBox(
  locator: ReturnType<Page["locator"]>,
  expected: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  for (const edge of ["x", "y", "width", "height"] as const) {
    expect(
      Math.abs((box?.[edge] ?? Number.NaN) - expected[edge]),
    ).toBeLessThanOrEqual(1);
  }
}

async function expectVerticalBox(
  page: Page,
  expected: {
    selector: string;
    y: number;
    height?: number;
    tolerance?: number;
  },
): Promise<void> {
  const box = await page.locator(expected.selector).boundingBox();
  expect(box, expected.selector).not.toBeNull();
  const tolerance = expected.tolerance ?? 1;
  expect(
    Math.abs((box?.y ?? Number.NaN) - expected.y),
    `${expected.selector} y`,
  ).toBeLessThanOrEqual(tolerance);
  if (expected.height !== undefined) {
    expect(
      Math.abs((box?.height ?? Number.NaN) - expected.height),
      `${expected.selector} height`,
    ).toBeLessThanOrEqual(tolerance);
  }
}

async function waitForAssets(page: Page): Promise<void> {
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

test.describe("Task 6 authentication fidelity", () => {
  for (const authCase of AUTH_CASES) {
    test(`${authCase.slug} preserves the complete authentication frame`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !["w360", "w1440"].includes(testInfo.project.name),
        "Task 6 evidence is captured at the approved fidelity widths.",
      );
      if (testInfo.project.name === "w1440")
        await page.setViewportSize({ width: 1440, height: 1024 });
      await page.goto(authCase.route);
      await expect(
        page.getByRole("heading", { name: authCase.heading, exact: true }),
      ).toBeVisible();
      await waitForAssets(page);
      await assertNoPageOverflow(page);
      await expect(page.getByRole("banner")).toHaveCount(0);
      await expect(page.getByRole("contentinfo")).toHaveCount(0);
      await expect(
        page.getByRole("img", { name: "BLUE", exact: true }),
      ).toBeVisible();
      if (testInfo.project.name === "w1440") {
        await expectBox(page.locator(".auth-page__shell"), {
          x: 80,
          y: 92,
          width: 1280,
          height: 840,
        });
        await expectBox(page.locator(".auth-page__form-zone"), {
          x: 136,
          y: 92,
          width: 608,
          height: 840,
        });
        await expectBox(page.locator(".auth-page__tabs"), {
          x: 210,
          y: 246,
          width: 460,
          height: 48,
        });
        await expectBox(page.locator(".brand-logo--auth"), {
          x: 210,
          y: 148,
          width: 126,
          height: 48,
        });
        await expectBox(page.locator(".brand-logo--auth .brand-logo__image"), {
          x: 218,
          y: 152,
          width: 110,
          height: 40,
        });
        const homeBox = await page.locator(".auth-page__home").boundingBox();
        expect(homeBox).not.toBeNull();
        expect(Math.abs((homeBox?.x ?? Number.NaN) - 508)).toBeLessThanOrEqual(
          2,
        );
        await expectBox(page.locator(".auth-page__scenic"), {
          x: 744,
          y: 92,
          width: 616,
          height: 840,
        });
        const contentBox = await page
          .locator(".auth-page__heading")
          .boundingBox();
        expect(contentBox).not.toBeNull();
        expect(contentBox?.x).toBe(210);
        expect((contentBox?.x ?? 0) + (contentBox?.width ?? 0)).toBe(670);
        const control = page.locator(authCase.controlSelector);
        const controlBox = await control.boundingBox();
        expect(controlBox).not.toBeNull();
        expect(controlBox?.x).toBe(210);
        expect((controlBox?.x ?? 0) + (controlBox?.width ?? 0)).toBe(
          authCase.controlRight,
        );
        for (const expected of authCase.verticalGeometry) {
          await expectVerticalBox(page, expected);
        }
      } else {
        await expect(page.locator(".auth-page__scenic")).toBeHidden();
      }
      const phase = process.env.TASK6_EVIDENCE_PHASE ?? "final";
      await page.screenshot({
        path: `docs/quality/evidence/task-6/${phase}/${authCase.slug}-${testInfo.project.name}.png`,
        fullPage: true,
      });
    });
  }
});
