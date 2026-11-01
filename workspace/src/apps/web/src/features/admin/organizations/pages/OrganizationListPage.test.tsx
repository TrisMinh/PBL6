import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminRepository } from "@/features/admin/repositories/adminRepository";
import type { Organization } from "@/features/admin/types/admin";
import { OrganizationListPage } from "@/features/admin/organizations/pages/OrganizationListPage";

const organizations: Organization[] = [
  {
    id: "org-blue-demo",
    name: "BLUE Demo Transit",
    contactName: "Điều phối mô phỏng A",
    contactEmail: "ops-a@blue.example.invalid",
    contactPhone: "0000000101",
    status: "active",
    createdAt: "2026-01-10T02:00:00.000Z",
    updatedAt: "2026-10-01T03:00:00.000Z",
  },
];

const repository = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  createOrganization: vi.fn(),
}));

vi.mock("@/features/auth/hooks/useMockSession", () => ({
  useMockSession: () => ({
    isHydrated: true,
    session: {
      userId: "admin-demo",
      role: "admin",
      token: "mock-session-admin-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
  }),
}));

vi.mock("@/features/admin/repositories/httpAdminRepository", () => ({
  createHttpAdminRepository: () => repository as unknown as AdminRepository,
}));

function renderPage(initialEntry = "/admin/organizations"): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <OrganizationListPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

function LocationProbe(): ReactElement {
  const location = useLocation();
  return (
    <output aria-label="Current URL">{`${location.pathname}${location.search}`}</output>
  );
}

describe("OrganizationListPage", () => {
  beforeEach(() => {
    repository.listOrganizations.mockReset().mockResolvedValue({
      items: organizations,
      page: 1,
      pageSize: 20,
      total: 40,
    });
    repository.createOrganization.mockReset().mockResolvedValue({
      ...organizations[0],
      id: "org-created",
      name: "Nhà xe thử nghiệm",
    });
  });

  it("shows Figma legal fields in the URL-owned create dialog", async () => {
    renderPage("/admin/organizations?dialog=create");
    expect(
      await screen.findByRole("dialog", { name: "Thêm tổ chức" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Mã số thuế")).toBeVisible();
    expect(screen.getByLabelText("Địa chỉ")).toBeVisible();
  });

  it("renders Figma list columns and a detail link", async () => {
    renderPage();
    expect(await screen.findByText("BLUE Demo Transit")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Tổ chức" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Mã tổ chức" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "BLUE Demo Transit" }),
    ).toHaveAttribute("href", "/admin/organizations/org-blue-demo");
  });

  it("renders a distinct empty state", async () => {
    repository.listOrganizations.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Chưa có tổ chức phù hợp" }),
    ).toBeInTheDocument();
  });

  it("closes create without discarding owned filters", async () => {
    const user = userEvent.setup();
    renderPage("/admin/organizations?query=blue&page=2&dialog=create");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Đóng hộp thoại" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Current URL")).toHaveTextContent(
      "/admin/organizations?query=blue&page=2",
    );
  });

  it("validates create, preserves list URL, closes and invalidates on success", async () => {
    const user = userEvent.setup();
    const client = renderPage(
      "/admin/organizations?query=blue&page=2&dialog=create",
    );
    const invalidate = vi.spyOn(client, "invalidateQueries");
    expect(
      await screen.findByRole("dialog", { name: "Thêm tổ chức" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    expect(
      await screen.findByText("Tên tổ chức là bắt buộc."),
    ).toBeInTheDocument();
    expect(repository.createOrganization).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Tên hiển thị"), "Nhà xe thử nghiệm");
    await user.type(screen.getByLabelText("Tên pháp lý"), "Công ty thử nghiệm");
    await user.type(screen.getByLabelText("Mã số thuế"), "1234567890");
    await user.type(screen.getByLabelText("Địa chỉ"), "Đà Nẵng");
    await user.type(
      screen.getByLabelText("Email liên hệ"),
      "ops@test.example.invalid",
    );
    await user.type(screen.getByLabelText("Số điện thoại"), "0000000999");
    await user.click(screen.getByRole("button", { name: "Tạo tổ chức" }));

    await waitFor(() =>
      expect(repository.createOrganization).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Đã tạo tổ chức.")).toHaveAttribute(
      "role",
      "status",
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["admin", "organizations"],
    });
    expect(screen.getByLabelText("Current URL")).toHaveTextContent(
      "/admin/organizations?query=blue&page=2",
    );
  });
});
