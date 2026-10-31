import { test, expect } from "@playwright/test";

test("live UI uses backend login, inventory, hold, booking and payment contracts", async ({
  page,
}) => {
  const id = (n: number): string =>
    `019a3a71-0000-7000-8000-${String(n).padStart(12, "0")}`;
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const trip = {
    id: id(1),
    organizationId: id(2),
    operatorName: "Nhà xe kiểm thử",
    busType: "SLEEPER",
    amenities: ["WIFI"],
    departureAt: `${date}T08:00:00+07:00`,
    arrivalAt: `${date}T12:00:00+07:00`,
    origin: "Hồ Chí Minh",
    destination: "Đà Lạt",
    fare: { amount: 200000, currency: "VND" },
    status: "SCHEDULED",
    sellable: true,
    availableSeatCount: 1,
    availabilityAsOf: new Date().toISOString(),
    rowVersion: 0,
    stops: [
      {
        id: id(3),
        name: "Bến đi",
        sequence: 0,
        offsetMinutes: 0,
        pickupAllowed: true,
        dropoffAllowed: false,
      },
      {
        id: id(4),
        name: "Bến đến",
        sequence: 1,
        offsetMinutes: 240,
        pickupAllowed: false,
        dropoffAllowed: true,
      },
    ],
  };
  const seat = {
    id: id(5),
    code: "1A",
    type: "STANDARD",
    status: "AVAILABLE",
    price: trip.fare,
    rowVersion: 0,
  };
  let bookingBody: Record<string, unknown> | undefined;
  let sawPayment = false;
  const unexpected: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (path === "/api/v1/auth/login") {
      expect(request.postDataJSON()).toEqual({
        identifier: "customer@example.com",
        password: "Password123",
      });
      return route.fulfill({
        json: {
          accessToken: "header.payload.signature",
          refreshToken: "refresh",
          tokenType: "Bearer",
          expiresIn: 3600,
          sessionId: id(8),
          user: { id: id(9), roles: ["CUSTOMER"] },
        },
      });
    }
    if (path === "/api/v1/tickets")
      return route.fulfill({
        json: { page: 0, size: 20, totalElements: 0, totalPages: 0, items: [] },
      });
    if (path === "/api/v1/trips") {
      expect(url.searchParams.get("origin")).toBe("Hồ Chí Minh");
      expect(url.searchParams.get("destination")).toBe("Đà Lạt");
      return route.fulfill({
        json: {
          page: 0,
          size: 100,
          totalElements: 1,
          totalPages: 1,
          items: [trip],
        },
      });
    }
    if (path === `/api/v1/trips/${id(1)}`) return route.fulfill({ json: trip });
    expect(request.headers().authorization).toBe(
      "Bearer header.payload.signature",
    );
    if (path.endsWith("/seats"))
      return route.fulfill({ json: { tripId: id(1), seats: [seat] } });
    if (path.endsWith("/seat-holds")) {
      expect(request.postDataJSON()).toEqual({
        seatIds: [id(5)],
        pickupStopId: id(3),
        dropoffStopId: id(4),
      });
      return route.fulfill({
        status: 201,
        json: {
          holdToken: "actual-hold",
          tripId: id(1),
          status: "ACTIVE",
          seats: [seat],
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          serverTime: new Date().toISOString(),
        },
      });
    }
    if (path === "/api/v1/bookings") bookingBody = request.postDataJSON();
    const booking = {
      id: id(6),
      code: "BK123456789",
      customerId: id(9),
      tripId: id(1),
      status: "PENDING_PAYMENT",
      paymentChannel: "PREPAID",
      total: 200000,
      currency: "VND",
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      rowVersion: 0,
      contact: {
        fullName: "Khách Kiểm Thử",
        email: "customer@example.com",
        phone: "0901234567",
      },
      items: [
        {
          seatId: id(5),
          fullName: "Khách Kiểm Thử",
          pickupStopId: id(3),
          dropoffStopId: id(4),
        },
      ],
    };
    if (path === "/api/v1/bookings" || path === `/api/v1/bookings/${id(6)}`)
      return route.fulfill({
        status: request.method() === "POST" ? 201 : 200,
        json: booking,
      });
    if (path === `/api/v1/bookings/${id(6)}/payments`) {
      sawPayment = true;
      expect(request.postDataJSON()).toMatchObject({
        provider: "VNPAY_SANDBOX",
        method: "VNPAY_QR",
      });
      return route.fulfill({
        status: 201,
        json: {
          id: id(7),
          bookingId: id(6),
          status: "SUCCEEDED",
          amount: 200000,
          currency: "VND",
        },
      });
    }
    unexpected.push(path);
    await route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/login");
  await page
    .getByLabel("Email hoặc số điện thoại")
    .fill("customer@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Vé của tôi", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await page.getByLabel("Điểm đi", { exact: true }).fill("Hồ Chí Minh");
  await page.getByLabel("Điểm đến", { exact: true }).fill("Đà Lạt");
  await page.getByLabel("Ngày đi", { exact: true }).fill(date);
  await page.getByRole("button", { name: "Tìm chuyến", exact: true }).click();
  await page.getByRole("button", { name: "Chọn chuyến", exact: true }).click();
  await page.getByRole("button", { name: "Ghế 1A", exact: true }).click();
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await page.getByLabel("Họ và tên (ghế 1A)").fill("Khách Kiểm Thử");
  await page.getByLabel("Email nhận vé").fill("customer@example.com");
  await page.getByLabel("Họ và tên người liên hệ").fill("Khách Kiểm Thử");
  await page.getByLabel("Số điện thoại người liên hệ").fill("0901234567");
  await page
    .getByRole("button", { name: "Xác nhận thông tin", exact: true })
    .click();
  await page.getByRole("button", { name: /Tiếp tục thanh toán/ }).click();
  await expect(
    page.getByRole("heading", { name: "Thanh toán đặt vé" }),
  ).toBeVisible();
  expect(bookingBody).toMatchObject({
    holdToken: "actual-hold",
    expectedTotal: 200000,
    currency: "VND",
    paymentChannel: "PREPAID",
  });
  await page.evaluate(() => sessionStorage.removeItem("blue-booking-draft"));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Thanh toán đặt vé" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Thanh toán qua VNPay", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /Giao dịch đã hoàn tất/ }),
  ).toBeVisible();
  expect(sawPayment).toBe(true);
  const ticket = {
    id: id(10),
    publicCode: "TKT123456",
    bookingId: id(6),
    tripId: id(1),
    passengerName: "Khách Kiểm Thử",
    seatCode: "1A",
    status: "ISSUED",
    paymentChannel: "PREPAID",
    issuedAt: new Date().toISOString(),
    rowVersion: 0,
  };
  await page.route("**/api/v1/tickets**", (route) =>
    route.fulfill({
      json:
        new URL(route.request().url()).pathname === "/api/v1/tickets"
          ? {
              page: 0,
              size: 100,
              totalElements: 1,
              totalPages: 1,
              items: [ticket],
            }
          : ticket,
    }),
  );
  await page.route(`**/api/v1/bookings/${id(6)}`, (route) =>
    route.fulfill({
      json: {
        id: id(6),
        code: "BK123456789",
        customerId: id(9),
        tripId: id(1),
        status: "PAID",
        paymentChannel: "PREPAID",
        total: 200000,
        currency: "VND",
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        rowVersion: 7,
        contact: {
          fullName: "Khách Kiểm Thử",
          email: "customer@example.com",
          phone: "0901234567",
        },
        items: [],
      },
    }),
  );
  await page.route(
    `**/api/v1/bookings/${id(6)}/cancellation-preview`,
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({ ticketIds: [id(10)] });
      await route.fulfill({
        json: {
          previewId: id(11),
          ticketIds: [id(10)],
          policyVersion: "policy-v1",
          fee: 20000,
          refundAmount: 180000,
          currency: "VND",
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        },
      });
    },
  );
  await page.route(`**/api/v1/bookings/${id(6)}/cancel`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      previewId: id(11),
      expectedVersion: 7,
      reason: "Đổi lịch trình",
    });
    await route.fulfill({
      status: 202,
      json: { operationId: id(6), status: "ACCEPTED" },
    });
  });
  await page.goto("/account/tickets");
  await page
    .getByRole("link", { name: ticket.publicCode, exact: true })
    .click();
  await page.getByRole("link", { name: "Xem chính sách hủy vé" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Tính phí hủy", exact: true }).click();
  await page.getByLabel("Lý do hủy").fill("Đổi lịch trình");
  await page
    .getByRole("button", { name: "Xác nhận hủy các vé đã chọn", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Yêu cầu hủy đã được tiếp nhận",
  );
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});
