import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminRepository } from "@/features/admin/repositories/adminRepository";
import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import type { Organization, Staff } from "@/features/admin/types/admin";
import { StaffListPage } from "@/features/admin/staff/pages/StaffListPage";

const organization: Organization = {
  id: "org-blue-demo",
  name: "BLUE Demo Transit",
  contactName: "Điều phối A",
  contactEmail: "ops@test.example.invalid",
  contactPhone: "0000000101",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const staff: Staff = {
  id: "staff-blue-01",
  organizationId: organization.id,
  fullName: "Nhân viên mô phỏng A",
  email: "staff@test.example.invalid",
  phone: "0000000201",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const membershipRepository = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

const repository = vi.hoisted(() => ({
  listStaff: vi.fn(),
  listOrganizations: vi.fn(),
  createStaff: vi.fn(),
  updateStaff: vi.fn(),
}));

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

function renderPage(entry = "/admin/staff"): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <StaffListPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe("StaffListPage", () => {
  beforeEach(() => {
    membershipRepository.list.mockReset().mockResolvedValue([]);
    membershipRepository.create.mockReset();
    membershipRepository.update.mockReset();
    repository.listStaff
      .mockReset()
      .mockResolvedValue({ items: [staff], page: 1, pageSize: 20, total: 40 });
    repository.listOrganizations.mockReset().mockResolvedValue({
      items: [organization],
      page: 1,
      pageSize: 100,
      total: 1,
    });
    repository.updateStaff.mockReset().mockResolvedValue(staff);
  });

  it("renders staff columns, organization filter and detail link", async () => {
    renderPage();
    expect(
      await screen.findByRole("link", { name: staff.fullName }),
    ).toHaveAttribute("href", `/admin/staff/${staff.id}`);
    expect(
      screen.getByRole("columnheader", { name: "Nhà xe" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: organization.name }),
    ).toBeInTheDocument();
  });

  it("renders a distinct empty state", async () => {
    repository.listStaff.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Chưa có nhân viên phù hợp" }),
    ).toBeInTheDocument();
  });

  it("renders an error state and retries the staff query", async () => {
    const user = userEvent.setup();
    repository.listStaff.mockRejectedValueOnce(
      new AdminRepositoryError("HTTP_ERROR", 503),
    );
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Tải dữ liệu thất bại" }),
    ).toBeInTheDocument();
    repository.listStaff.mockResolvedValueOnce({
      items: [staff],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(
      await screen.findByRole("link", { name: staff.fullName }),
    ).toBeInTheDocument();
  });

  it("closes dialog while preserving list params", async () => {
    const user = userEvent.setup();
    renderPage(
      "/admin/staff?organizationId=org-blue-demo&page=2&dialog=create",
    );
    await screen.findByRole("dialog", { name: "Thêm thành viên" });
    await user.click(screen.getByRole("button", { name: "Đóng hộp thoại" }));
    expect(screen.getByLabelText("Current URL")).toHaveTextContent(
      "/admin/staff?organizationId=org-blue-demo&page=2",
    );
  });

  it("validates required fields and organization before create", async () => {
    const user = userEvent.setup();
    renderPage("/admin/staff?dialog=create");
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: organization.name });
    await user.click(
      within(dialog).getByRole("button", { name: "Thêm thành viên" }),
    );
    expect(await screen.findByText("Hãy chọn nhân viên.")).toBeInTheDocument();
    expect(screen.getByText("Hãy chọn nhà xe.")).toBeInTheDocument();
    expect(screen.getByText("Hãy nhập lý do.")).toBeInTheDocument();
    expect(membershipRepository.create).not.toHaveBeenCalled();
  });

  it("creates once, locks pending, preserves URL and invalidates staff", async () => {
    const user = userEvent.setup();
    let resolveCreate: ((value: Staff) => void) | undefined;
    membershipRepository.create.mockImplementation(
      () =>
        new Promise<Staff>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const client = renderPage("/admin/staff?query=demo&page=2&dialog=create");
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: organization.name });
    await within(dialog).findByRole("option", { name: staff.fullName });
    await user.selectOptions(
      within(dialog).getByLabelText("Nhà xe"),
      organization.id,
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Nhân viên"),
      staff.id,
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Vai trò"),
      "OPERATOR_SCHEDULER",
    );
    await user.type(within(dialog).getByLabelText("Lý do"), "Phân công");
    const submit = within(dialog).getByRole("button", {
      name: "Thêm thành viên",
    });
    await user.click(submit);
    await waitFor(() =>
      expect(membershipRepository.create).toHaveBeenCalledTimes(1),
    );
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(membershipRepository.create).toHaveBeenCalledTimes(1);
    resolveCreate?.({ ...staff, id: "staff-created" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["admin", "memberships"],
    });
    expect(screen.getByLabelText("Current URL")).toHaveTextContent(
      "/admin/staff?query=demo&page=2",
    );
    expect(screen.getByText("Đã thêm nhân viên.")).toHaveAttribute(
      "role",
      "status",
    );
  });
});
