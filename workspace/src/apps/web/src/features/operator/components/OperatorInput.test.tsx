import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { OperatorInput } from "./OperatorInput";

it("keeps date form values, labels, limits and validation feedback with the customer calendar", () => {
  const change = vi.fn();
  render(
    <OperatorInput
      label="Từ ngày"
      type="date"
      name="from"
      value="2026-11-17"
      min="2026-11-01"
      max="2026-11-30"
      error="Kiểm tra ngày"
      onChange={change}
    />,
  );
  const input = screen.getByLabelText("Từ ngày");
  expect(input).toHaveValue("2026-11-17");
  expect(input).toHaveAttribute("min", "2026-11-01");
  expect(input).toHaveAttribute("max", "2026-11-30");
  expect(input).toHaveAccessibleDescription("Kiểm tra ngày");
  expect(
    screen.getByRole("button", { name: "Mở lịch chọn ngày" }),
  ).toHaveAttribute("type", "button");
  fireEvent.change(input, { target: { value: "2026-11-18" } });
  expect(change).toHaveBeenCalledOnce();
});
