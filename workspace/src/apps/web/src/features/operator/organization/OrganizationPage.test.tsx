import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it } from "vitest";
import { OrganizationPage } from "./OrganizationPage";
import { SettlementsPage } from "./SettlementsPage";
import { readWorkspace } from "./operatorWorkspace";

beforeEach(() => sessionStorage.clear());

it("invites a member through the visible dialog and persists the selected role", () => {
  render(
    <MemoryRouter>
      <OrganizationPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Thêm thành viên" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Họ và tên"), {
    target: { value: "Nguyễn Bảo Ngọc" },
  });
  fireEvent.change(dialog.getByLabelText("Email công việc"), {
    target: { value: "ngoc@demo.example.invalid" },
  });
  fireEvent.change(dialog.getByLabelText("Số điện thoại"), {
    target: { value: "0912345678" },
  });
  fireEvent.change(dialog.getByLabelText("Vai trò"), {
    target: { value: "accountant" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Gửi lời mời" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Nguyễn Bảo Ngọc" }),
  ).toBeInTheDocument();
  expect(
    readWorkspace().members.find(
      (m) => m.email === "ngoc@demo.example.invalid",
    ),
  ).toMatchObject({ role: "accountant", status: "invited" });
});

it("shows a helpful empty state and restores all members when clearing filters", () => {
  render(
    <MemoryRouter>
      <OrganizationPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Tìm thành viên"), {
    target: { value: "khong-co-thanh-vien" },
  });
  expect(
    screen.getByRole("heading", { name: "Không tìm thấy thành viên" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
  expect(
    screen.getByRole("heading", { name: "Nguyễn Hoàng Long" }),
  ).toBeInTheDocument();
});

it("protects the last administrator through the confirmation UI", () => {
  render(
    <MemoryRouter>
      <OrganizationPage />
    </MemoryRouter>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Tạm ngưng Nguyễn Hoàng Long" }),
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Xác nhận",
    }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "ít nhất một quản trị viên",
  );
  expect(readWorkspace().members[0].status).toBe("active");
});

it("opens settlement breakdown and validates date order before export", () => {
  render(
    <MemoryRouter>
      <SettlementsPage />
    </MemoryRouter>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Xem chi tiết DS-2609-001" }),
  );
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("BK-260905-018")).toBeInTheDocument();
  expect(dialog.getByText("BLUE-TRANSFER-00001")).toBeInTheDocument();
  fireEvent.click(dialog.getByRole("button", { name: "Đóng" }));
  fireEvent.change(screen.getByLabelText("Từ ngày"), {
    target: { value: "2026-10-01" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Ngày bắt đầu phải trước",
  );
  expect(screen.getByRole("button", { name: "Xuất CSV" })).toBeDisabled();
});
