import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminRepository } from "@/features/admin/repositories/adminRepository";
import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import { isOrganizationNotFound } from "@/features/admin/organizations/lib/organizationErrors";
import { OrganizationDetailPage } from "@/features/admin/organizations/pages/OrganizationDetailPage";

const membershipRepository = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

const repository = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  listStaff: vi.fn(),
  listOrganizations: vi.fn(),
}));

vi.mock("@/features/auth/hooks/useMockSession", () => ({
  useMockSession: () => ({
    isHydrated: true,
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

function renderPage(
  initialEntry = "/admin/organizations/org-blue-demo",
): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <OrganizationDetailPage organizationId="org-blue-demo" />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

function seedMemberData(): void {
  const organization = {
    id: "org-blue-demo",
    name: "BLUE Demo Transit",
    contactEmail: "test+org@example.invalid",
    contactPhone: "0000000101",
    status: "active",
    createdAt: "2026-08-01T02:00:00.000Z",
    updatedAt: "2026-08-01T02:00:00.000Z",
  };
  repository.getOrganization.mockResolvedValue(organization);
  repository.listOrganizations.mockResolvedValue({
    items: [organization],
    page: 1,
    pageSize: 100,
    total: 1,
  });
  repository.listStaff.mockResolvedValue({
    items: [
      {
        id: "test-member",
        organizationId: "org-blue-demo",
        fullName: "Thành viên thử nghiệm",
        email: "test+member@example.invalid",
        phone: "0000000102",
        status: "active",
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    ],
    page: 1,
    pageSize: 100,
    total: 1,
  });
  membershipRepository.list.mockResolvedValue([
    {
      staffId: "test-member",
      organizationId: "org-blue-demo",
      role: "DRIVER",
      status: "active",
      reason: "Phân công thử nghiệm",
      memberSince: "2026-08-04",
    },
  ]);
}

describe("OrganizationDetailPage", () => {
  beforeEach(() => {
    membershipRepository.list.mockReset().mockResolvedValue([]);
    membershipRepository.create.mockReset();
    membershipRepository.update.mockReset();
    repository.listStaff.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
    repository.listOrganizations.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
    repository.getOrganization.mockReset();
    repository.updateOrganization.mockReset();
  });

  it("renders distinct detail groups", async () => {
    repository.getOrganization.mockResolvedValue({
      id: "org-blue-demo",
      name: "BLUE Demo Transit",
      contactName: "Điều phối mô phỏng A",
      contactEmail: "ops-a@blue.example.invalid",
      contactPhone: "0000000101",
      status: "active",
      createdAt: "2026-01-10T02:00:00.000Z",
      updatedAt: "2026-10-01T03:00:00.000Z",
    });
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "BLUE Demo Transit" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Thông tin pháp lý" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Thông tin liên hệ" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Trạng thái và cập nhật" }),
    ).toBeInTheDocument();
  });

  it("distinguishes not-found from other repository failures", () => {
    expect(
      isOrganizationNotFound(new AdminRepositoryError("HTTP_ERROR", 404)),
    ).toBe(true);
    expect(
      isOrganizationNotFound(new AdminRepositoryError("HTTP_ERROR", 503)),
    ).toBe(false);
  });

  it("edits, preserves unrelated URL state and invalidates list/detail", async () => {
    const organization = {
      id: "org-blue-demo",
      name: "BLUE Demo Transit",
      contactName: "Điều phối mô phỏng A",
      contactEmail: "ops-a@blue.example.invalid",
      contactPhone: "0000000101",
      status: "inactive" as const,
      createdAt: "2026-01-10T02:00:00.000Z",
      updatedAt: "2026-10-01T03:00:00.000Z",
    };
    repository.getOrganization.mockResolvedValue(organization);
    repository.updateOrganization.mockResolvedValue({
      ...organization,
      name: "BLUE Updated",
    });
    const client = renderPage(
      "/admin/organizations/org-blue-demo?from=list&dialog=edit",
    );
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const user = userEvent.setup();
    expect(
      await screen.findByRole("dialog", { name: "Chỉnh sửa tổ chức" }),
    ).toBeInTheDocument();
    const name = screen.getByLabelText("Tên hiển thị");
    await user.clear(name);
    await user.type(name, "BLUE Updated");
    await user.type(screen.getByLabelText("Tên pháp lý"), "Công ty thử nghiệm");
    await user.type(screen.getByLabelText("Mã số thuế"), "1234567890");
    await user.type(screen.getByLabelText("Địa chỉ"), "Đà Nẵng");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(repository.updateOrganization).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByLabelText("Current URL")).toHaveTextContent(
      "/admin/organizations/org-blue-demo?from=list",
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["admin", "organizations"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["admin", "organizations", "detail", "org-blue-demo"],
    });
    expect(screen.getByText("Đã cập nhật tổ chức.")).toBeInTheDocument();
  });

  it("filters memberships and edits role while retaining unrelated member URL state", async () => {
    seedMemberData();
    membershipRepository.update.mockResolvedValue({});
    renderPage("/admin/organizations/org-blue-demo?view=members&future=keep");
    const user = userEvent.setup();
    await screen.findByText("Thành viên thử nghiệm");
    await user.selectOptions(screen.getByLabelText("Trạng thái"), "inactive");
    expect(screen.queryByText("Thành viên thử nghiệm")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Trạng thái"), "active");
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    await screen.findByRole("dialog", { name: "Chỉnh sửa thông tin" });
    await user.selectOptions(
      screen.getByLabelText("Vai trò"),
      "OPERATOR_ADMIN",
    );
    await user.type(
      screen.getByLabelText("Lý do thay đổi"),
      "Chuyển phân công",
    );
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() =>
      expect(membershipRepository.update).toHaveBeenCalledWith({
        staffId: "test-member",
        organizationId: "org-blue-demo",
        role: "OPERATOR_ADMIN",
        status: "active",
        reason: "Chuyển phân công",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Current URL")).toHaveTextContent(
      "view=members&future=keep&status=active",
    );
  });

  it("creates a membership using a stable mutation key and closes only its owned dialog", async () => {
    seedMemberData();
    membershipRepository.list.mockResolvedValue([]);
    membershipRepository.create.mockResolvedValue({});
    renderPage(
      "/admin/organizations/org-blue-demo?view=members&future=keep&dialog=create-member",
    );
    const user = userEvent.setup();
    await screen.findByRole("dialog", { name: "Thêm thành viên" });
    await user.selectOptions(screen.getByLabelText("Nhân viên"), "test-member");
    await user.selectOptions(screen.getByLabelText("Vai trò"), "DRIVER");
    await user.type(
      screen.getByLabelText("Lý do", { exact: true }),
      "Thêm phân công",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Thêm thành viên",
        hidden: false,
      }),
    );
    await waitFor(() =>
      expect(membershipRepository.create).toHaveBeenCalledWith(
        {
          staffId: "test-member",
          organizationId: "org-blue-demo",
          role: "DRIVER",
          status: "active",
          reason: "Thêm phân công",
        },
        expect.stringMatching(/^[0-9a-f-]{36}$/),
      ),
    );
    expect(screen.getByLabelText("Current URL")).toHaveTextContent(
      "view=members&future=keep",
    );
  });
});
