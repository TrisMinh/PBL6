import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminRepository } from "@/features/admin/repositories/adminRepository";
import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import { isStaffNotFound } from "@/features/admin/staff/lib/staffErrors";
import { StaffDetailPage } from "@/features/admin/staff/pages/StaffDetailPage";

const membershipRepository = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

const repository = vi.hoisted(() => ({
  getStaff: vi.fn(),
  listOrganizations: vi.fn(),
  updateStaff: vi.fn(),
}));
const staff = {
  id: "staff-blue-01",
  organizationId: "org-blue-demo",
  fullName: "Nhân viên mô phỏng A",
  email: "staff@test.example.invalid",
  phone: "0000000201",
  status: "active" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const organization = {
  id: "org-blue-demo",
  name: "BLUE Demo Transit",
  contactName: "Điều phối A",
  contactEmail: "ops@test.example.invalid",
  contactPhone: "0000000101",
  status: "active" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

vi.mock("@/features/auth/hooks/useMockSession", () => ({
  useMockSession: () => ({
    session: { role: "admin", token: "mock-session-admin-token" },
  }),
}));
vi.mock("@/features/admin/repositories/httpAdminRepository", () => ({
  createHttpAdminRepository: () => repository as unknown as AdminRepository,
  createMembershipRepository: () => membershipRepository,
}));

function LocationProbe(): ReactElement {
  const location = useLocation();
  return (
    <output aria-label="Current URL">{`${location.pathname}${location.search}`}</output>
  );
}
function renderPage(entry = "/admin/staff/staff-blue-01"): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <StaffDetailPage staffId={staff.id} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe("StaffDetailPage", () => {
  beforeEach(() => {
    membershipRepository.list.mockReset().mockResolvedValue([]);
    membershipRepository.create.mockReset();
    membershipRepository.update.mockReset();
    membershipRepository.list.mockResolvedValue([
      {
        staffId: staff.id,
        organizationId: staff.organizationId,
        role: "OPERATOR_SCHEDULER",
        status: "active",
        reason: "Test",
        memberSince: "2026-01-01",
      },
    ]);
    membershipRepository.update.mockResolvedValue({
      staffId: staff.id,
      organizationId: staff.organizationId,
      role: "DRIVER",
      status: "active",
      reason: "Điều chỉnh vai trò",
      memberSince: "2026-01-01",
    });
    repository.getStaff.mockReset().mockResolvedValue(staff);
    repository.listOrganizations.mockReset().mockResolvedValue({
      items: [organization],
      page: 1,
      pageSize: 100,
      total: 1,
    });
    repository.updateStaff
      .mockReset()
      .mockResolvedValue({ ...staff, fullName: "Nhân viên cập nhật" });
  });

  it("renders detail groups and organization name", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Chi tiết nhân viên" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Thông tin tài khoản" }),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText(organization.name)).length,
    ).toBeGreaterThan(0);
  });

  it("distinguishes not-found errors", () => {
    expect(isStaffNotFound(new AdminRepositoryError("HTTP_ERROR", 404))).toBe(
      true,
    );
    expect(isStaffNotFound(new AdminRepositoryError("HTTP_ERROR", 503))).toBe(
      false,
    );
  });

  it("renders the not-found detail state", async () => {
    repository.getStaff.mockRejectedValueOnce(
      new AdminRepositoryError("HTTP_ERROR", 404),
    );
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Không tìm thấy nhân viên" }),
    ).toBeInTheDocument();
  });

  it("edits, preserves URL and invalidates staff list/detail", async () => {
    const client = renderPage(`/admin/staff/${staff.id}?from=list&dialog=edit`);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const user = userEvent.setup();
    await screen.findByRole("dialog", { name: "Chỉnh sửa thông tin" });
    await user.selectOptions(screen.getByLabelText("Vai trò"), "DRIVER");
    await user.type(
      screen.getByLabelText("Lý do thay đổi"),
      "Điều chỉnh vai trò",
    );
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(membershipRepository.update).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByLabelText("Current URL")).toHaveTextContent(
      `/admin/staff/${staff.id}?from=list`,
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["admin", "memberships"],
    });
    expect(screen.getByText("Đã cập nhật nhân viên.")).toBeInTheDocument();
  });

  it("manages platform support role without creating an operator membership", async () => {
    repository.getStaff.mockResolvedValue({
      ...staff,
      role: "PLATFORM_SUPPORT",
      organizationId: "platform-blue",
      status: "inactive",
    });
    membershipRepository.list.mockResolvedValue([]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "Gán vai trò" });
    expect(screen.getAllByText("Được cấp từ")).toHaveLength(2);
    await user.click(
      await screen.findByRole("button", { name: "Gán vai trò" }),
    );
    await screen.findByRole("dialog", { name: "Vai trò nền tảng" });
    await user.type(
      screen.getByLabelText("Lý do thay đổi"),
      "Xác nhận quyền hỗ trợ",
    );
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(repository.updateStaff).toHaveBeenCalledWith(
        staff.id,
        expect.objectContaining({
          organizationId: "platform-blue",
          role: "PLATFORM_SUPPORT",
          membershipReason: "Xác nhận quyền hỗ trợ",
        }),
      ),
    );
    expect(membershipRepository.update).not.toHaveBeenCalled();
    expect(membershipRepository.create).not.toHaveBeenCalled();
  });
});
