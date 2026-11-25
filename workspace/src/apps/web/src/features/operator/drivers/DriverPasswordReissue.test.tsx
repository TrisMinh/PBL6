import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { DriverPasswordReissue } from "./DriverPasswordReissue";
import { reissueDriverPassword } from "./driversRepository";

vi.mock("./driversRepository", () => ({ reissueDriverPassword: vi.fn() }));

it("only reissues after confirmation and clears the revealed password when closed", async () => {
  const user = userEvent.setup();
  const membershipId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
  vi.mocked(reissueDriverPassword).mockResolvedValueOnce({
    email: "driver@example.test",
    password: "SampleOnly2026",
  });
  render(
    <DriverPasswordReissue membershipId={membershipId} name="Tài xế mẫu" />,
  );

  await user.click(screen.getByRole("button", { name: "Cấp lại mật khẩu" }));
  expect(reissueDriverPassword).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Xác nhận cấp lại" }));
  const handoff = await screen.findByRole("dialog", {
    name: "Đã cấp lại mật khẩu",
  });
  expect(reissueDriverPassword).toHaveBeenCalledExactlyOnceWith(membershipId);
  const password = within(handoff).getByLabelText("Mật khẩu tạm thời");
  expect(password).toHaveAttribute("type", "password");
  await user.click(
    within(handoff).getByRole("button", { name: "Hiện mật khẩu" }),
  );
  expect(password).toHaveAttribute("type", "text");
  await user.click(within(handoff).getByRole("button", { name: "Hoàn tất" }));
  expect(screen.queryByLabelText("Mật khẩu tạm thời")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cấp lại mật khẩu" }));
  expect(screen.queryByLabelText("Mật khẩu tạm thời")).not.toBeInTheDocument();
});
