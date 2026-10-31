import { expect, test, type Locator } from "@playwright/test";

import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";
import { HomePage } from "./pages/HomePage";
import { BookingReviewPage } from "./pages/BookingReviewPage";
import { PassengerDetailsPage } from "./pages/PassengerDetailsPage";
import { TripResultsPage } from "./pages/TripResultsPage";
import { PaymentPage } from "./pages/PaymentPage";
import { TicketPage } from "./pages/TicketPage";

const FIDELITY_PROJECTS = new Set(["w360", "w1440"]);

async function expectBox(
  locator: Locator,
  expected: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs((box?.x ?? 0) - expected.x)).toBeLessThanOrEqual(1);
  expect(Math.abs((box?.y ?? 0) - expected.y)).toBeLessThanOrEqual(1);
  expect(Math.abs((box?.width ?? 0) - expected.width)).toBeLessThanOrEqual(1);
  expect(Math.abs((box?.height ?? 0) - expected.height)).toBeLessThanOrEqual(1);
}

async function expectBelow(
  upper: Locator,
  lower: Locator,
  gap = 0,
): Promise<void> {
  const [upperBox, lowerBox] = await Promise.all([
    upper.boundingBox(),
    lower.boundingBox(),
  ]);
  expect(upperBox).not.toBeNull();
  expect(lowerBox).not.toBeNull();
  expect(lowerBox?.y ?? 0).toBeGreaterThanOrEqual(
    (upperBox?.y ?? 0) + (upperBox?.height ?? 0) + gap,
  );
}

async function expectContained(
  container: Locator,
  content: Locator,
): Promise<void> {
  const [containerBox, contentBox] = await Promise.all([
    container.boundingBox(),
    content.boundingBox(),
  ]);
  expect(containerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(contentBox?.x ?? 0).toBeGreaterThanOrEqual(containerBox?.x ?? 0);
  expect(contentBox?.y ?? 0).toBeGreaterThanOrEqual(containerBox?.y ?? 0);
  expect((contentBox?.x ?? 0) + (contentBox?.width ?? 0)).toBeLessThanOrEqual(
    (containerBox?.x ?? 0) + (containerBox?.width ?? 0) + 1,
  );
  expect((contentBox?.y ?? 0) + (contentBox?.height ?? 0)).toBeLessThanOrEqual(
    (containerBox?.y ?? 0) + (containerBox?.height ?? 0) + 1,
  );
}

test.beforeEach(({ browserName }, testInfo) => {
  void browserName;
  test.skip(
    !FIDELITY_PROJECTS.has(testInfo.project.name),
    "Fidelity evidence is captured at the approved mobile and desktop widths.",
  );
});

test("Results node 28:30 preserves search, filters, six cards and pagination", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "w1440")
    await page.setViewportSize({ width: 1440, height: 1280 });
  const results = new TripResultsPage(page);
  await results.goto();
  await results.expectCount(24);
  await results.expectPageSize(6);
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
  await expect(page.locator("img[src*='figma.com/api/mcp/asset']")).toHaveCount(
    0,
  );
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Phân trang kết quả chuyến" }),
  ).toBeVisible();
  const expectedCards = [
    [
      "BLUE Expres.",
      "Limousine 11 chỗ",
      "07:00",
      "13:30",
      "6 giờ 30",
      "Còn 6 ghế",
      "320.000 ₫",
    ],
    [
      "An Lạc",
      "Giường nằm 40 chỗ",
      "08:00",
      "14:15",
      "6 giờ 15",
      "Còn 12 ghế",
      "280.000 ₫",
    ],
    [
      "Thiên Việt",
      "Cabin 24 phòng",
      "09:30",
      "15:45",
      "6 giờ 15",
      "Còn 4 ghế",
      "390.000 ₫",
    ],
    [
      "Minh Châu",
      "Limousine 24 chỗ",
      "11:00",
      "17:20",
      "6 giờ 20",
      "Còn 9 ghế",
      "330.000 ₫",
    ],
    [
      "Cao Nguyên",
      "Limousine giường 34",
      "13:30",
      "20:00",
      "6 giờ 30",
      "Còn 15 ghế",
      "275.000 ₫",
    ],
    [
      "Đồi Xanh",
      "Giường phòng 21",
      "22:00",
      "04:30",
      "6 giờ 30",
      "Còn 7 ghế",
      "350.000 ₫",
    ],
  ];
  for (const [index, copy] of expectedCards.entries()) {
    const card = results.cards.nth(index);
    for (const text of copy)
      await expect(card.getByText(text, { exact: true })).toBeVisible();
    const operator = card.locator(".trip-card__operator");
    await expect(operator).toHaveCSS("white-space", "nowrap");
    const operatorGeometry = await operator.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(
      operatorGeometry.scrollWidth,
      `operator ${index + 1} must stay on one line`,
    ).toBeLessThanOrEqual(operatorGeometry.clientWidth);
  }

  if (testInfo.project.name === "w1440") {
    const minimumFare = page.getByLabel("Giá tối thiểu");
    await minimumFare.focus();
    await page.keyboard.press("ArrowRight");
    await expect(minimumFare).toHaveValue("225000");

    await expectBox(page.locator(".customer-layout__header"), {
      x: 80,
      y: 18,
      width: 1280,
      height: 72,
    });
    await expectBox(page.locator(".trip-results__search"), {
      x: 80,
      y: 112,
      width: 1280,
      height: 190,
    });
    await expectBox(page.locator(".trip-filters__desktop"), {
      x: 80,
      y: 336,
      width: 260,
      height: 850,
    });
    await expectBox(page.locator(".trip-card").first(), {
      x: 370,
      y: 446,
      width: 318,
      height: 300,
    });
    await expectBox(page.locator(".trip-card").nth(5), {
      x: 1042,
      y: 766,
      width: 318,
      height: 300,
    });
    expect(page.viewportSize()).toEqual({ width: 1440, height: 1280 });
  } else {
    await expect(
      page.getByRole("button", { name: "Bộ lọc và sắp xếp" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Mở menu" })).toBeVisible();
    await expect(page.locator(".trip-card")).toHaveCount(6);
  }
});

test("Home node 128:870 preserves every section and official asset slot", async ({
  page,
}, testInfo) => {
  const home = new HomePage(page);
  await home.goto();
  await home.expectLoaded();
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

  const logos = page.getByRole("img", { name: "BLUE", exact: true });
  await expect(logos).toHaveCount(2);
  await expect(logos.first()).toHaveAttribute(
    "src",
    /blue-official-logo\.png$/,
  );
  await expect(page.locator("img[src*='figma.com/api/mcp/asset']")).toHaveCount(
    0,
  );

  if (testInfo.project.name === "w1440") {
    await expectBox(page.locator(".customer-layout__header"), {
      x: 80,
      y: 18,
      width: 1280,
      height: 72,
    });
    await expectBox(page.locator(".home-hero"), {
      x: 80,
      y: 96,
      width: 1280,
      height: 650,
    });
    await expectBox(page.locator(".search-form"), {
      x: 135,
      y: 584,
      width: 1168,
      height: 128,
    });
    await expectBox(page.locator(".product-truths"), {
      x: 80,
      y: 782,
      width: 1280,
      height: 96,
    });
    await expectBox(page.locator(".trust-journey"), {
      x: 80,
      y: 1338,
      width: 1280,
      height: 430,
    });
    await expectBox(page.locator(".support-banner"), {
      x: 80,
      y: 1814,
      width: 1280,
      height: 300,
    });
    await expectBox(page.locator(".home-footer"), {
      x: 80,
      y: 2180,
      width: 1280,
      height: 390,
    });
    await expectBox(page.locator(".brand-logo__image").first(), {
      x: 119,
      y: 34,
      width: 110,
      height: 40,
    });
    await expectBox(page.locator(".popular-routes__card").first(), {
      x: 80,
      y: 1026,
      width: 308,
      height: 240,
    });
    await expectBox(page.locator(".trust-journey__visual"), {
      x: 80,
      y: 1338,
      width: 560,
      height: 430,
    });
  } else {
    await expect(page.locator(".home-page")).toBeVisible();
    await expect(page.locator(".popular-routes__scroller")).toHaveCSS(
      "overflow-x",
      "auto",
    );
    await expect(page.getByRole("button", { name: "Mở menu" })).toBeVisible();
  }
});

test("Passenger node 30:344 preserves its complete form and summary frame", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "w1440")
    await page.setViewportSize({ width: 1440, height: 1040 });
  const passengers = new PassengerDetailsPage(page);
  await passengers.start();
  await page.evaluate(() => document.fonts.ready);
  await assertNoPageOverflow(page);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(page.locator(".passenger-form__card--passenger")).toHaveCount(2);
  await expect(page.getByRole("group", { name: "Điểm đón" })).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Nhận vé và yêu cầu cho nhà xe" }),
  ).toBeVisible();
  await expect(page.locator("img[src*='figma.com/api/mcp/asset']")).toHaveCount(
    0,
  );

  if (testInfo.project.name === "w1440") {
    await expectBox(page.locator(".passenger-form"), {
      x: 80,
      y: 230,
      width: 820,
      height: 730,
    });
    await expectBox(page.locator(".booking-summary--passenger"), {
      x: 930,
      y: 230,
      width: 430,
      height: 700,
    });
  } else {
    await expect(page.locator(".passenger-form")).toBeVisible();
    await expect(page.locator(".booking-summary--passenger")).toBeVisible();
  }
});

test("Review node 30:416 preserves journey, passenger, policy and payment summary", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "w1440")
    await page.setViewportSize({ width: 1440, height: 1040 });
  const review = new BookingReviewPage(page);
  await review.start();
  await page.evaluate(() => document.fonts.ready);
  await assertNoPageOverflow(page);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Hành trình & nhà xe" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Hành khách và điểm đón" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Điều kiện đặt vé" }),
  ).toBeVisible();
  await expect(page.locator("img[src*='figma.com/api/mcp/asset']")).toHaveCount(
    0,
  );

  if (testInfo.project.name === "w1440") {
    await expectBox(page.locator(".booking-review"), {
      x: 80,
      y: 230,
      width: 820,
      height: 720,
    });
    await expectBox(page.locator(".booking-summary--review"), {
      x: 930,
      y: 230,
      width: 430,
      height: 720,
    });
  } else {
    await expect(page.locator(".booking-review")).toBeVisible();
    await expect(page.locator(".booking-summary--review")).toBeVisible();
  }
});

test("VNPay checkout node 561:306 preserves its 820/430 payment frame", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "w1440")
    await page.setViewportSize({ width: 1440, height: 1040 });
  const payment = new PaymentPage(page);
  await payment.start();
  await assertNoPageOverflow(page);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(
    page.getByText("VNPay Sandbox", { exact: true }).first(),
  ).toBeVisible();
  const checkout = page.locator(".payment-checkout");
  const intro = checkout.locator(".payment-checkout__intro");
  const provider = checkout.locator(".payment-checkout__provider");
  const details = checkout.locator(".payment-checkout__details");
  const safety = checkout.locator(".payment-checkout__safety");
  await expectBelow(intro, checkout.locator(".payment-checkout__grid"), 8);
  await expectBelow(details, safety, 8);
  await expectContained(safety, safety.locator("strong"));
  await expectContained(safety, safety.locator("p"));
  if (testInfo.project.name === "w360") {
    await expectBelow(provider, details, 8);
  }
  if (testInfo.project.name === "w1440") {
    await expectBox(page.locator(".payment-checkout"), {
      x: 80,
      y: 230,
      width: 820,
      height: 720,
    });
    await expectBox(page.locator(".booking-summary--payment"), {
      x: 930,
      y: 230,
      width: 430,
      height: 720,
    });
  }
});

const RETURN_GEOMETRY_CASES = [
  {
    name: "processing",
    paymentLabel: "Mô phỏng chờ xác nhận",
    heading: "Thanh toán đang chờ xác nhận",
    recheck: false,
  },
  {
    name: "pending recheck",
    paymentLabel: "Mô phỏng chờ xác nhận",
    heading: "Thanh toán đang chờ xác nhận",
    recheck: true,
  },
  {
    name: "failed retry",
    paymentLabel: "Mô phỏng thất bại",
    heading: "Thanh toán chưa thành công",
    recheck: false,
  },
  {
    name: "cancelled recovery",
    paymentLabel: "Mô phỏng hủy",
    heading: "Đã hủy thanh toán",
    recheck: false,
  },
  {
    name: "success and issued links",
    paymentLabel: "Mô phỏng thành công",
    heading: "Thanh toán thành công",
    recheck: false,
  },
] as const;

for (const returnCase of RETURN_GEOMETRY_CASES) {
  test(`Payment return ${returnCase.name} keeps every text layer separated and contained`, async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "w1440")
      await page.setViewportSize({ width: 1440, height: 900 });
    const payment = new PaymentPage(page);
    await payment.start();
    await payment.pay(returnCase.paymentLabel);
    await payment.expectState(returnCase.heading);
    if (returnCase.recheck) await payment.recheck();

    const heading = page.locator(".payment-page__heading");
    const title = heading.getByRole("heading", { level: 1 });
    const subtitle = heading.locator("p[role='status']");
    const card = page.locator(".payment-result");
    const journey = card.locator(".payment-result__journey");
    const reference = card.locator(".payment-result__reference");
    const routeTitle = journey.getByRole("heading", { level: 2 });
    const routeMeta = journey.locator("p");
    const body = card.locator(".payment-result__body");

    await expectBelow(title, subtitle);
    await expectBelow(subtitle, card, 8);
    await expectBelow(reference, routeTitle, 4);
    await expectBelow(routeTitle, routeMeta);
    await expectBelow(journey, body);
    await expectContained(card, body);
    await expectContained(card, body.locator(":scope > div"));
    await expectContained(card, body.locator(":scope > aside"));
    const lastTicket = card.locator(".payment-result__tickets li").last();
    if ((await lastTicket.count()) > 0) await expectContained(card, lastTicket);
    await assertNoPageOverflow(page);
  });
}

test("Payment processing node 30:469 preserves the 1120x520 ticket frame", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "w1440")
    await page.setViewportSize({ width: 1440, height: 900 });
  const payment = new PaymentPage(page);
  await payment.start();
  await payment.pay("Mô phỏng chờ xác nhận");
  await payment.expectState("Thanh toán đang chờ xác nhận");
  await assertNoPageOverflow(page);
  await expect(page.getByText("ĐANG XỬ LÝ · TỰ ĐỘNG CẬP NHẬT")).toBeVisible();
  if (testInfo.project.name === "w1440")
    await expectBox(page.locator(".payment-result"), {
      x: 160,
      y: 230,
      width: 1120,
      height: 520,
    });
});

test("Issued ticket node 30:489 preserves its 1120x620 bounded QR frame", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "w1440")
    await page.setViewportSize({ width: 1440, height: 1080 });
  const ticket = new TicketPage(page);
  const bookingCode = await ticket.issued();
  await ticket.requireLookup();
  await ticket.lookup(bookingCode);
  await ticket.expectIssued();
  await assertNoPageOverflow(page);
  await expect(
    page.getByRole("img", { name: "Mã vé minh họa, không dùng để quét" }),
  ).toHaveAttribute("data-presentation-only", "true");
  if (testInfo.project.name === "w1440")
    await expectBox(page.locator(".ticket-card"), {
      x: 160,
      y: 230,
      width: 1120,
      height: 620,
    });
});
