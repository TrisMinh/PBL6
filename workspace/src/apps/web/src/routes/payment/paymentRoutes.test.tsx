import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router";

import Checkout, { meta as checkoutMeta } from "@/routes/payment/vnpay";
import Return, { meta as returnMeta } from "@/routes/payment/vnpay-return";

afterEach(cleanup);
it("checkout delegates to the safe missing-booking page and retains noindex", () => {
  render(
    <MemoryRouter>
      <Checkout />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "Không tìm thấy đặt vé còn hiệu lực" }),
  ).toBeVisible();
  expect(checkoutMeta()).toContainEqual({
    name: "robots",
    content: "noindex, nofollow",
  });
});
it("public callback delegates invalid IDs to safe recovery outside the hold guard", () => {
  render(
    <MemoryRouter>
      <Return />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "Không thể xác nhận giao dịch" }),
  ).toBeVisible();
  expect(returnMeta()).toContainEqual({
    name: "robots",
    content: "noindex, nofollow",
  });
});
