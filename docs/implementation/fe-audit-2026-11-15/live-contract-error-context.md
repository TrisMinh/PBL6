# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking.spec.ts >> live UI uses backend login, inventory, hold, booking and payment contracts
- Location: tests\live\booking.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Vé của tôi', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Vé của tôi', exact: true }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Vé của tôi', exact: true })

```

```yaml
- link "Đến nội dung chính":
  - /url: "#main-content"
- banner:
  - link "BLUE — Trang chủ":
    - /url: /
    - img "BLUE"
  - navigation "Điều hướng chính":
    - list:
      - listitem:
        - link "Trang chủ":
          - /url: /
      - listitem:
        - link "Khám phá":
          - /url: /explore
      - listitem:
        - link "Điểm đến":
          - /url: /trips
      - listitem:
        - link "Vé xe":
          - /url: /account/tickets
  - link "Hành trình của tôi":
    - /url: /account/tickets
  - button "Thông báo"
  - link "Đặt vé":
    - /url: /trips
- main:
  - paragraph: TÀI KHOẢN CỦA BẠN
  - heading "Những hành trình của tôi" [level=1]
  - paragraph: Thông tin cá nhân và mọi chuyến đi, ở cùng một nơi.
  - button "Đăng xuất"
  - complementary:
    - region "Hồ sơ cá nhân":
      - heading "Hồ sơ cá nhân" [level=2]
      - paragraph: Quản lý thông tin liên hệ của bạn.
      - alert:
        - strong: Chưa thể tải hoặc lưu thông tin
        - paragraph: Không thể thực hiện yêu cầu.
  - region "Lịch sử đặt vé":
    - heading "Lịch sử đặt vé" [level=2]
    - paragraph: Xem vé và theo dõi trạng thái đơn của bạn.
    - group "Loại danh sách":
      - button "Vé của tôi" [pressed]
      - button "Đơn đặt vé"
    - heading "Chuyến đi tiếp theo đang chờ bạn" [level=3]
    - paragraph: Vé của bạn sẽ xuất hiện tại đây sau khi đặt vé thành công.
    - link "Tìm chuyến xe":
      - /url: /
- contentinfo:
  - img "BLUE"
  - paragraph: Đi đúng chuyến, đặt đúng ghế.
```

# Test source

```ts
  77  |     if (path === "/api/v1/tickets")
  78  |       return route.fulfill({
  79  |         json: { page: 0, size: 20, totalElements: 0, totalPages: 0, items: [] },
  80  |       });
  81  |     if (path === "/api/v1/trips") {
  82  |       expect(url.searchParams.get("origin")).toBe("Hồ Chí Minh");
  83  |       expect(url.searchParams.get("destination")).toBe("Đà Lạt");
  84  |       return route.fulfill({
  85  |         json: {
  86  |           page: 0,
  87  |           size: 100,
  88  |           totalElements: 1,
  89  |           totalPages: 1,
  90  |           items: [trip],
  91  |         },
  92  |       });
  93  |     }
  94  |     if (path === `/api/v1/trips/${id(1)}`) return route.fulfill({ json: trip });
  95  |     expect(request.headers().authorization).toBe(
  96  |       "Bearer header.payload.signature",
  97  |     );
  98  |     if (path.endsWith("/seats"))
  99  |       return route.fulfill({ json: { tripId: id(1), seats: [seat] } });
  100 |     if (path.endsWith("/seat-holds")) {
  101 |       expect(request.postDataJSON()).toEqual({
  102 |         seatIds: [id(5)],
  103 |         pickupStopId: id(3),
  104 |         dropoffStopId: id(4),
  105 |       });
  106 |       return route.fulfill({
  107 |         status: 201,
  108 |         json: {
  109 |           holdToken: "actual-hold",
  110 |           tripId: id(1),
  111 |           status: "ACTIVE",
  112 |           seats: [seat],
  113 |           expiresAt: new Date(Date.now() + 600000).toISOString(),
  114 |           serverTime: new Date().toISOString(),
  115 |         },
  116 |       });
  117 |     }
  118 |     if (path === "/api/v1/bookings") bookingBody = request.postDataJSON();
  119 |     const booking = {
  120 |       id: id(6),
  121 |       code: "BK123456789",
  122 |       customerId: id(9),
  123 |       tripId: id(1),
  124 |       status: "PENDING_PAYMENT",
  125 |       paymentChannel: "PREPAID",
  126 |       total: 200000,
  127 |       currency: "VND",
  128 |       expiresAt: new Date(Date.now() + 600000).toISOString(),
  129 |       rowVersion: 0,
  130 |       contact: {
  131 |         fullName: "Khách Kiểm Thử",
  132 |         email: "customer@example.com",
  133 |         phone: "0901234567",
  134 |       },
  135 |       items: [
  136 |         {
  137 |           seatId: id(5),
  138 |           fullName: "Khách Kiểm Thử",
  139 |           pickupStopId: id(3),
  140 |           dropoffStopId: id(4),
  141 |         },
  142 |       ],
  143 |     };
  144 |     if (path === "/api/v1/bookings" || path === `/api/v1/bookings/${id(6)}`)
  145 |       return route.fulfill({
  146 |         status: request.method() === "POST" ? 201 : 200,
  147 |         json: booking,
  148 |       });
  149 |     if (path === `/api/v1/bookings/${id(6)}/payments`) {
  150 |       sawPayment = true;
  151 |       expect(request.postDataJSON()).toMatchObject({
  152 |         provider: "VNPAY_SANDBOX",
  153 |         method: "VNPAY_QR",
  154 |       });
  155 |       return route.fulfill({
  156 |         status: 201,
  157 |         json: {
  158 |           id: id(7),
  159 |           bookingId: id(6),
  160 |           status: "SUCCEEDED",
  161 |           amount: 200000,
  162 |           currency: "VND",
  163 |         },
  164 |       });
  165 |     }
  166 |     unexpected.push(path);
  167 |     await route.fulfill({ status: 404, json: {} });
  168 |   });
  169 |   await page.goto("/login");
  170 |   await page
  171 |     .getByLabel("Email hoặc số điện thoại")
  172 |     .fill("customer@example.com");
  173 |   await page.getByLabel("Mật khẩu", { exact: true }).fill("Password123");
  174 |   await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  175 |   await expect(
  176 |     page.getByRole("heading", { name: "Vé của tôi", exact: true }),
> 177 |   ).toBeVisible();
      |     ^ Error: expect(locator).toBeVisible() failed
  178 |   await page.goto("/");
  179 |   await page.getByLabel("Điểm đi", { exact: true }).fill("Hồ Chí Minh");
  180 |   await page.getByLabel("Điểm đến", { exact: true }).fill("Đà Lạt");
  181 |   await page.getByLabel("Ngày đi", { exact: true }).fill(date);
  182 |   await page.getByRole("button", { name: "Tìm chuyến", exact: true }).click();
  183 |   await page.getByRole("button", { name: "Chọn chuyến", exact: true }).click();
  184 |   await page.getByRole("button", { name: "Ghế 1A", exact: true }).click();
  185 |   await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  186 |   await page.getByLabel("Họ và tên (ghế 1A)").fill("Khách Kiểm Thử");
  187 |   await page.getByLabel("Email nhận vé").fill("customer@example.com");
  188 |   await page.getByLabel("Họ và tên người liên hệ").fill("Khách Kiểm Thử");
  189 |   await page.getByLabel("Số điện thoại người liên hệ").fill("0901234567");
  190 |   await page
  191 |     .getByRole("button", { name: "Xác nhận thông tin", exact: true })
  192 |     .click();
  193 |   await page.getByRole("button", { name: /Tiếp tục thanh toán/ }).click();
  194 |   await expect(
  195 |     page.getByRole("heading", { name: "Thanh toán đặt vé" }),
  196 |   ).toBeVisible();
  197 |   expect(bookingBody).toMatchObject({
  198 |     holdToken: "actual-hold",
  199 |     expectedTotal: 200000,
  200 |     currency: "VND",
  201 |     paymentChannel: "PREPAID",
  202 |   });
  203 |   await page.evaluate(() => sessionStorage.removeItem("blue-booking-draft"));
  204 |   await page.reload();
  205 |   await expect(
  206 |     page.getByRole("heading", { name: "Thanh toán đặt vé" }),
  207 |   ).toBeVisible();
  208 |   await page
  209 |     .getByRole("button", { name: "Thanh toán qua VNPay", exact: true })
  210 |     .click();
  211 |   await expect(
  212 |     page.getByRole("link", { name: /Giao dịch đã hoàn tất/ }),
  213 |   ).toBeVisible();
  214 |   expect(sawPayment).toBe(true);
  215 |   const ticket = {
  216 |     id: id(10),
  217 |     publicCode: "TKT123456",
  218 |     bookingId: id(6),
  219 |     tripId: id(1),
  220 |     passengerName: "Khách Kiểm Thử",
  221 |     seatCode: "1A",
  222 |     status: "ISSUED",
  223 |     paymentChannel: "PREPAID",
  224 |     issuedAt: new Date().toISOString(),
  225 |     rowVersion: 0,
  226 |   };
  227 |   await page.route("**/api/v1/tickets**", (route) =>
  228 |     route.fulfill({
  229 |       json:
  230 |         new URL(route.request().url()).pathname === "/api/v1/tickets"
  231 |           ? {
  232 |               page: 0,
  233 |               size: 100,
  234 |               totalElements: 1,
  235 |               totalPages: 1,
  236 |               items: [ticket],
  237 |             }
  238 |           : ticket,
  239 |     }),
  240 |   );
  241 |   await page.route(`**/api/v1/bookings/${id(6)}`, (route) =>
  242 |     route.fulfill({
  243 |       json: {
  244 |         id: id(6),
  245 |         code: "BK123456789",
  246 |         customerId: id(9),
  247 |         tripId: id(1),
  248 |         status: "PAID",
  249 |         paymentChannel: "PREPAID",
  250 |         total: 200000,
  251 |         currency: "VND",
  252 |         expiresAt: new Date(Date.now() + 600000).toISOString(),
  253 |         rowVersion: 7,
  254 |         contact: {
  255 |           fullName: "Khách Kiểm Thử",
  256 |           email: "customer@example.com",
  257 |           phone: "0901234567",
  258 |         },
  259 |         items: [],
  260 |       },
  261 |     }),
  262 |   );
  263 |   await page.route(
  264 |     `**/api/v1/bookings/${id(6)}/cancellation-preview`,
  265 |     async (route) => {
  266 |       expect(route.request().postDataJSON()).toEqual({ ticketIds: [id(10)] });
  267 |       await route.fulfill({
  268 |         json: {
  269 |           previewId: id(11),
  270 |           ticketIds: [id(10)],
  271 |           policyVersion: "policy-v1",
  272 |           fee: 20000,
  273 |           refundAmount: 180000,
  274 |           currency: "VND",
  275 |           expiresAt: new Date(Date.now() + 600000).toISOString(),
  276 |         },
  277 |       });
```