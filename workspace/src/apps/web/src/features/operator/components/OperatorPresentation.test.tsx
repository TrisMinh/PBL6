import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { displayCode } from "./displayCode";
import { OperatorPagination } from "./OperatorPagination";

it("shortens technical identifiers without changing existing business codes", () => {
  expect(displayCode("01a1825e-ce81-77ac-a288-7ec225093288")).toBe(
    "CX-25093288",
  );
  expect(displayCode("BK405D9939522A", "BK")).toBe("BK405D9939522A");
  expect(displayCode("01a1825e-ce81-77ac-a288-7ec225093288", "DS")).toBe(
    "DS-25093288",
  );
});
it("makes every page reachable without rendering an unbounded row of page buttons", () => {
  const change = vi.fn();
  const { rerender } = render(
    <OperatorPagination page={1} total={352} pageSize={10} onChange={change} />,
  );
  expect(screen.getByRole("button", { name: "Trang trước" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Trang 36" }));
  expect(change).toHaveBeenCalledWith(36);
  rerender(
    <OperatorPagination
      page={36}
      total={352}
      pageSize={10}
      onChange={change}
    />,
  );
  expect(screen.getByText("Hiển thị 351–352 trong 352 kết quả")).toBeVisible();
  expect(screen.getByRole("button", { name: "Trang sau" })).toBeDisabled();
  expect(screen.getAllByRole("button").length).toBeLessThan(12);
});
