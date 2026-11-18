import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { expect, it, vi } from "vitest";
import { LiveTransactionFilters } from "./LiveTransactionFilters";
vi.mock("@/features/admin/staff/hooks/useStaffData", () => ({
  useStaffOrganizations: () => ({
    data: { items: [{ id: "real-org", name: "Actual operator" }] },
    isPending: false,
    isError: false,
  }),
}));
function Location(): React.ReactElement {
  return <output data-testid="url">{useLocation().search}</output>;
}
it("searches arbitrary real codes and filters real organization/state while resetting pagination", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/admin/payments?page=4&future=keep"]}>
      <LiveTransactionFilters resource="payments" onSearch={vi.fn()} />
      <Location />
    </MemoryRouter>,
  );
  await user.type(
    screen.getByRole("textbox", { name: "Tìm kiếm giao dịch" }),
    "REAL-PAYMENT-123",
  );
  await user.click(screen.getByRole("button", { name: "Tra cứu" }));
  expect(screen.getByTestId("url")).toHaveTextContent("query=REAL-PAYMENT-123");
  expect(screen.getByTestId("url")).not.toHaveTextContent("page=4");
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Nhà xe" }),
    "real-org",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Trạng thái" }),
    "refunded",
  );
  expect(screen.getByTestId("url")).toHaveTextContent(
    "organizationId=real-org",
  );
  expect(screen.getByTestId("url")).toHaveTextContent("status=refunded");
  expect(screen.getByTestId("url")).toHaveTextContent("future=keep");
  expect(screen.queryByText("BlueLine Co.")).not.toBeInTheDocument();
});
