import { expect, test, type Page } from "@playwright/test";

import { assertNoPageOverflow } from "./helpers/assertNoPageOverflow";
import { AdminPage } from "./pages/AdminPage";
import { AuthPage } from "./pages/AuthPage";
import { BookingReviewPage } from "./pages/BookingReviewPage";
import { PassengerDetailsPage } from "./pages/PassengerDetailsPage";
import { PaymentPage } from "./pages/PaymentPage";
import { SeatSelectionPage } from "./pages/SeatSelectionPage";
import { TicketPage } from "./pages/TicketPage";
import { TripResultsPage } from "./pages/TripResultsPage";

const FIXED_NOW = new Date("2026-10-23T08:00:00+07:00");
const VISUAL_PROJECTS = new Set(["w360", "w1440"]);

test.use({ colorScheme: "light", reducedMotion: "reduce" });

async function installDeterministicBrowser(page: Page): Promise<void> {
  await page.clock.install({ time: FIXED_NOW });
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: () => {
        const storageKey = "blue-visual-uuid-sequence";
        const uuidSequence =
          Number(sessionStorage.getItem(storageKey) ?? "0") + 1;
        sessionStorage.setItem(storageKey, String(uuidSequence));
        const sequenceHex = uuidSequence.toString(16).padStart(8, "0");
        return `${sequenceHex}-0000-4000-8000-${String(uuidSequence).padStart(12, "0")}`;
      },
    });

    const installVisualStyle = (): void => {
      if (document.querySelector("style[data-visual-test]")) return;
      const style = document.createElement("style");
      style.dataset.visualTest = "true";
      style.textContent = `
        *, *::before, *::after {
          animation-delay: 0s !important;
          animation-duration: 0s !important;
          caret-color: transparent !important;
          scroll-behavior: auto !important;
          transition-delay: 0s !important;
          transition-duration: 0s !important;
        }
      `;
      document.head.append(style);
    };

    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", installVisualStyle, {
        once: true,
      });
    else installVisualStyle();
  });
}

async function capture(
  page: Page,
  name: string,
  options: { resetScroll?: boolean } = {},
): Promise<void> {
  await expect(page.locator("main").first()).toBeVisible();
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
  if (options.resetScroll) {
    await page.evaluate(() => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  }
  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    maxDiffPixelRatio: 0.002,
  });
}

async function startPayment(page: Page): Promise<PaymentPage> {
  const payment = new PaymentPage(page);
  await payment.start();
  return payment;
}

async function installAdminScenarioControl(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const scenario = sessionStorage.getItem("admin-e2e-scenario");
      if (!scenario || !url.includes("/api/v1/admin/"))
        return originalFetch(input, init);
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      headers.set("x-mock-scenario", scenario);
      return originalFetch(input, { ...init, headers });
    };
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    !VISUAL_PROJECTS.has(testInfo.project.name),
    "Visual baselines are intentionally limited to the approved mobile and desktop widths.",
  );
  await installDeterministicBrowser(page);
});

test("captures the canonical customer Home", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-heading")).toBeVisible();
  await expect(page.getByRole("form", { name: "Tìm chuyến" })).toBeVisible();
  await expect(page.getByLabel("Điểm đi", { exact: true })).toBeEnabled();
  await capture(page, "customer-home");
});

test("captures Customer Results node 28:30", async ({ page }) => {
  const results = new TripResultsPage(page);
  await results.goto();
  await results.expectCount(24);
  await results.expectPageSize(6);
  await capture(page, "customer-trip-results");
});

test("captures Task4 Passenger node 30:344", async ({ page }) => {
  const passengers = new PassengerDetailsPage(page);
  await passengers.start();
  await passengers.fill();
  await capture(page, "customer-passengers");
});

test("captures Task4 Review node 30:416", async ({ page }) => {
  const review = new BookingReviewPage(page);
  await review.start();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Kiểm tra trước khi thanh toán",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await capture(page, "customer-booking-review", { resetScroll: true });
});

test("captures the canonical customer booking and issued-ticket journey", async ({
  page,
}) => {
  const results = new TripResultsPage(page);
  await results.goto();
  await results.expectCount(24);
  await capture(page, "customer-trip-results");

  await results.selectFirst();
  await results.expectBookingStarted();
  const seats = new SeatSelectionPage(page);
  await seats.select("A01");
  await seats.select("A02");
  await seats.continue();

  await page.getByLabel("Họ và tên (ghế A01)").fill("Khách Một");
  await page
    .getByLabel("Số điện thoại (ghế A01, không bắt buộc)")
    .fill("0912345678");
  await page.getByLabel("Họ và tên (ghế A02)").fill("Khách Hai");
  await page
    .getByLabel("Họ và tên người liên hệ")
    .fill("Khách Liên Hệ", { force: true });
  await page
    .getByLabel("Số điện thoại người liên hệ")
    .fill("0912345678", { force: true });
  await page.getByLabel("Email nhận vé").fill("test+review@example.invalid");
  await capture(page, "customer-passengers");
  await page.getByRole("button", { name: "Xác nhận thông tin" }).dblclick();

  await expect(
    page.getByRole("heading", { name: "Kiểm tra trước khi thanh toán" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Kiểm tra trước khi thanh toán",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await capture(page, "customer-booking-review", { resetScroll: true });
  const review = new BookingReviewPage(page);
  await review.continue();
  await capture(page, "customer-vnpay-checkout");

  const payment = new PaymentPage(page);
  await payment.pay();
  await payment.expectState("Thanh toán thành công");
  await capture(page, "customer-payment-success", { resetScroll: true });

  const bookingCode = await page
    .getByRole("article", { name: "Kết quả giao dịch" })
    .getByText(/^BLUE-[A-Z0-9-]+$/)
    .textContent();
  expect(bookingCode).toBeTruthy();
  const ticket = new TicketPage(page);
  await ticket.requireLookup();
  await ticket.lookup(bookingCode ?? "");
  await ticket.expectIssued();
  await capture(page, "customer-ticket-issued");
});

test("captures the sleeper seat layout", async ({ page }) => {
  const results = new TripResultsPage(page);
  await results.goto();
  await results.expectCount(24);
  await results.cards
    .nth(1)
    .getByRole("button", { name: "Chọn chuyến" })
    .click();
  const seats = new SeatSelectionPage(page);
  await seats.select("A01");
  await seats.select("A02");
  await capture(page, "customer-seats-sleeper");
});

test("captures the cabin layout", async ({ page }) => {
  const results = new TripResultsPage(page);
  await results.goto();
  await results.expectCount(24);
  await results.cards
    .nth(0)
    .getByRole("button", { name: "Chọn chuyến" })
    .click();
  await expect(page).toHaveURL(/\/booking\/[^/]+\/seats$/);
  await expect(
    page.getByRole("heading", { name: "Chọn cabin của bạn", exact: true }),
  ).toBeVisible();
  await capture(page, "customer-seats-cabin");
});

test("captures a competing-seat conflict", async ({ page }) => {
  const conflict = new SeatSelectionPage(page);
  await conflict.start();
  await conflict.select("A01");
  await conflict.holdInCompetingSession("A02");
  await conflict.selectConflicting("A02");
  await expect(page.getByRole("dialog")).toBeVisible();
  await capture(page, "customer-seat-conflict");
});

test("captures an expired seat hold", async ({ page }) => {
  const expired = new SeatSelectionPage(page);
  await expired.start();
  await expired.select("A01");
  await page.clock.setFixedTime(new Date(FIXED_NOW.getTime() + 600_001));
  await expired.expireCurrentHold();
  await capture(page, "customer-hold-expired");
});

test("captures the six-seat limit", async ({ page }) => {
  const results = new TripResultsPage(page);
  await results.goto(
    "originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=6",
  );
  await results.cards
    .nth(1)
    .getByRole("button", { name: "Chọn chuyến" })
    .click();
  const seats = new SeatSelectionPage(page);
  for (const code of ["A01", "A02", "A03", "A04", "A05", "A06"])
    await seats.select(code);
  await seats.seat("A07").click();
  await expect(
    page.getByRole("dialog", { name: "Bạn đã chọn đủ 6 chỗ" }),
  ).toBeVisible();
  await capture(page, "customer-seat-limit");
});

for (const paymentState of [
  {
    label: "Mô phỏng thất bại",
    heading: "Thanh toán chưa thành công",
    snapshot: "customer-payment-failed",
  },
  {
    label: "Mô phỏng hủy",
    heading: "Đã hủy thanh toán",
    snapshot: "customer-payment-cancelled",
  },
  {
    label: "Mô phỏng chờ xác nhận",
    heading: "Thanh toán đang chờ xác nhận",
    snapshot: "customer-payment-pending",
  },
]) {
  test(`captures ${paymentState.heading.toLowerCase()}`, async ({ page }) => {
    const payment = await startPayment(page);
    await payment.pay(paymentState.label);
    await payment.expectState(paymentState.heading);
    await capture(page, paymentState.snapshot, { resetScroll: true });
  });
}

test("captures the canonical Login node 64:427", async ({ page }) => {
  await new AuthPage(page).openLogin();
  await capture(page, "customer-auth-login");
});

test("captures the canonical Register node 64:431", async ({ page }) => {
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Tạo tài khoản BLUE.", exact: true }),
  ).toBeVisible();
  await capture(page, "customer-auth-register");
});

test("captures the canonical Forgot Password node 64:435", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Quên mật khẩu?", exact: true }),
  ).toBeVisible();
  await capture(page, "customer-auth-forgot");
});

test("captures cancellation selection, confirmation and processing", async ({
  page,
}) => {
  const ticket = new TicketPage(page);
  const bookingCode = await ticket.issued();
  await ticket.requireLookup();
  await ticket.lookup(bookingCode);
  await ticket.expectIssued();
  await page.getByRole("link", { name: "Hủy vé", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chọn vé cần hủy" }),
  ).toBeVisible();
  await capture(page, "customer-cancellation-select");

  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Xem phí và tiền hoàn" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await capture(page, "customer-cancellation-confirm");
  await dialog.getByRole("button", { name: "Xác nhận hủy 1 vé" }).click();
  await expect(
    page.getByRole("heading", { name: "Theo dõi hoàn tiền" }),
  ).toBeVisible();
  await capture(page, "customer-cancellation-processing");
});

test("captures Task8 Organization list, detail and dialog", async ({
  page,
}) => {
  const admin = new AdminPage(page);
  await admin.login();
  await expect(
    page.getByRole("table", { name: "Danh sách tổ chức" }),
  ).toBeVisible();
  await capture(page, "admin-organizations-list");

  await page.getByRole("link", { name: "BlueLine Co." }).click();
  await expect(
    page.getByRole("heading", { name: "BlueLine Co." }),
  ).toBeVisible();
  await capture(page, "admin-organization-detail");

  await page.goto("/admin/organizations?dialog=create");
  await expect(
    page.getByRole("dialog", { name: "Thêm tổ chức" }),
  ).toBeVisible();
  await expect(page.locator(".admin-list-state--loading")).toHaveCount(0);
  await expect(
    page.getByRole("table", { name: "Danh sách tổ chức" }).locator("tbody tr"),
  ).toHaveCount(10);
  await capture(page, "admin-organization-dialog");
});

test("captures Task9 admin transaction list carry-forward", async ({
  page,
}) => {
  const admin = new AdminPage(page);
  await admin.login();
  await page.goto("/admin/bookings");
  await expect(
    page.getByRole("table", { name: "Danh sách đơn đặt vé" }),
  ).toBeVisible();
  await capture(page, "admin-transactions-list");
});

test("captures each shared admin state family", async ({ page }) => {
  await installAdminScenarioControl(page);
  const admin = new AdminPage(page);
  await admin.login();

  await page.evaluate(() =>
    sessionStorage.setItem("admin-e2e-scenario", "loading"),
  );
  await page.goto("/admin/bookings");
  await expect(page.getByRole("status")).toBeVisible();
  await capture(page, "admin-state-loading");

  await page.evaluate(() =>
    sessionStorage.setItem("admin-e2e-scenario", "empty"),
  );
  await page.goto("/admin/bookings");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy kết quả" }),
  ).toBeVisible();
  await capture(page, "admin-state-empty");

  await page.evaluate(() =>
    sessionStorage.setItem("admin-e2e-scenario", "error"),
  );
  await page.goto("/admin/payments");
  await expect(
    page.getByRole("heading", { name: "Chưa tải được dữ liệu" }),
  ).toBeVisible();
  await capture(page, "admin-state-error");

  await page.evaluate(() =>
    sessionStorage.setItem("admin-e2e-scenario", "forbidden"),
  );
  await page.goto("/admin/refunds");
  await expect(
    page.getByRole("heading", { name: "Bạn chưa có quyền truy cập" }),
  ).toBeVisible();
  await capture(page, "admin-state-forbidden");

  await page.evaluate(() =>
    sessionStorage.setItem("admin-e2e-scenario", "not-found"),
  );
  await page.goto("/admin/bookings/missing");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy hồ sơ" }),
  ).toBeVisible();
  await capture(page, "admin-state-not-found");
});
