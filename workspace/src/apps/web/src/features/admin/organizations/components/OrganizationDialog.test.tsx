import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { OrganizationDialog } from "./OrganizationDialog";

it("keeps the organization dialog mounted when Escape is pressed during mutation", async () => {
  const onClose = vi.fn();
  render(
    <OrganizationDialog
      mode="create"
      isPending
      onClose={onClose}
      onSubmit={async () => {}}
    />,
  );
  await userEvent.setup().keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
  expect(
    screen.getByRole("dialog", { name: "Thêm tổ chức" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Đóng hộp thoại" })).toBeDisabled();
});
