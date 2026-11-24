import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { MembershipDialog } from "./MembershipDialog";
import type { Organization, Staff } from "../../types/admin";

const organization: Organization = {
  id: "019b6100-0000-7000-8000-000000001001",
  name: "Hải Vân Travel",
  code: "HAI-VAN-TRAVEL",
  contactEmail: "test@example.test",
  contactPhone: "0900000000",
  status: "active",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
};
const staff: Staff = {
  id: "USR-0018",
  organizationId: organization.id,
  fullName: "Test staff",
  email: "staff@example.test",
  phone: "0900000001",
  status: "active",
  role: "DRIVER",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
};
it("marks an empty required field and associates its inline error", async () => {
  const onSubmit = vi.fn();
  render(
    <MembershipDialog
      organizations={[organization]}
      staff={[staff]}
      fixedOrganization={organization}
      fixedStaff={staff}
      isPending={false}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
  const reason = screen.getByRole("textbox", { name: "Lý do thay đổi" });
  expect(reason).toHaveAttribute("aria-invalid", "true");
  expect(reason).toHaveAccessibleDescription("Hãy nhập lý do.");
  expect(onSubmit).not.toHaveBeenCalled();
});
it.each(["HAI-VAN-TRAVEL", undefined])(
  "shows the stored organization code (%s), never its ID, while submitting the original ID",
  async (code) => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const record = { ...organization, code };
    render(
      <MembershipDialog
        organizations={[record]}
        staff={[staff]}
        fixedOrganization={record}
        fixedStaff={staff}
        isPending={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const fixed = document.querySelector(".membership-dialog__fixed");
    expect(fixed).toHaveTextContent(
      code ? `Hải Vân Travel · ${code}` : "Hải Vân Travel",
    );
    expect(fixed).not.toHaveTextContent(organization.id);
    await user.type(
      screen.getByRole("textbox", { name: "Lý do thay đổi" }),
      "Cập nhật vai trò",
    );
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        {
          staffId: staff.id,
          organizationId: organization.id,
          role: "DRIVER",
          status: "active",
          reason: "Cập nhật vai trò",
        },
        expect.any(String),
      ),
    );
  },
);
