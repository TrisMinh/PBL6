import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MockPaymentGateway } from "./MockPaymentGateway";

it("selects a bank and outcome without asking for real payment credentials", async () => {
  const pay = vi.fn();
  render(
    <MockPaymentGateway
      amount={640000}
      bookingId="BK-DEMO"
      pending={false}
      onPay={pay}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Chọn phương thức thanh toán" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Thanh toán VNPay mô phỏng" }),
  ).toBeVisible();
  expect(
    screen.getByRole("tab", { name: "Thẻ ATM / Ngân hàng" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Thẻ ATM / Ngân hàng" }));
  fireEvent.click(screen.getByRole("radio", { name: /Vietcombank/ }));
  expect(screen.getByText(/9704 00/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Kết quả giao dịch mô phỏng"), {
    target: { value: "failed" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Xác nhận thanh toán mô phỏng" }),
  );
  expect(pay).toHaveBeenCalledExactlyOnceWith("failed");
  expect(
    screen.queryByLabelText(/Mật khẩu|OTP|Số thẻ/i),
  ).not.toBeInTheDocument();
});

it("lets users cancel and disable submission while a payment is pending", () => {
  const pay = vi.fn();
  render(
    <MockPaymentGateway
      amount={640000}
      bookingId="BK-DEMO"
      pending={false}
      onPay={pay}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Chọn phương thức thanh toán" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Hủy giao dịch" }));
  expect(pay).toHaveBeenCalledExactlyOnceWith("cancelled");
});
