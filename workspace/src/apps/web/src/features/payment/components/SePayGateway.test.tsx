import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SePayGateway } from "./SePayGateway";

afterEach(cleanup);
it("keeps the original payment slots but starts signed checkout instead of fabricating a result", () => {
  const checkout = vi.fn();
  const page = render(
    <SePayGateway
      methods={["BANK_TRANSFER", "CARD"]}
      pending={false}
      onCheckout={checkout}
    />,
  );
  expect(
    page.container.querySelector(".mock-gateway--inline .mock-gateway__tabs"),
  ).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "SePay QR" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    screen.queryByText(/mô phỏng|NGUYEN VAN DEMO|Thẻ mẫu/i),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("tab", { name: "Thẻ ATM / Ngân hàng" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Thanh toán qua SePay" }));
  expect(checkout).toHaveBeenLastCalledWith("BANK_TRANSFER");
  fireEvent.click(screen.getByRole("tab", { name: "Thẻ quốc tế" }));
  fireEvent.click(screen.getByRole("button", { name: "Thanh toán qua SePay" }));
  expect(checkout).toHaveBeenLastCalledWith("CARD");
});
it("locks every submission while a checkout request is in flight", () => {
  const checkout = vi.fn();
  render(
    <SePayGateway methods={["BANK_TRANSFER"]} pending onCheckout={checkout} />,
  );
  expect(screen.getByRole("button", { name: "Đang xử lý" })).toBeDisabled();
  expect(screen.getByRole("tab", { name: "SePay QR" })).toBeDisabled();
});
