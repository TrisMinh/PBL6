import { act, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLayout } from "@/shared/layouts/AdminLayout";
import { MOCK_SESSION_STORAGE_KEY } from "@/features/auth/config/session";

const desktopQuery = {
  matches: false,
  addEventListener: vi.fn<(type: string, listener: () => void) => void>(),
  removeEventListener: vi.fn(),
};

beforeEach(() => {
  desktopQuery.matches = false;
  desktopQuery.addEventListener.mockClear();
  desktopQuery.removeEventListener.mockClear();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(desktopQuery));
});

afterEach(() => vi.unstubAllGlobals());

function renderAdminLayout(initialEntry = "/admin/organizations"): {
  router: ReturnType<typeof createMemoryRouter>;
  client: QueryClient;
} {
  const client = new QueryClient();
  const router = createMemoryRouter(
    [
      {
        element: <AdminLayout />,
        children: [{ path: "/admin/*", element: <h1>Nội dung quản trị</h1> }],
      },
      { path: "/login", element: <h1>Đăng nhập</h1> },
    ],
    { initialEntries: [initialEntry] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, client };
}

describe("AdminLayout", () => {
  it("keeps account actions admin-owned with keyboard Escape and focus return", async () => {
    const user = userEvent.setup();
    const { router } = renderAdminLayout();
    expect(
      screen.queryByRole("link", { name: "Tài khoản" }),
    ).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Tài khoản" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", { name: "Tài khoản quản trị" });
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Đóng tài khoản" }),
      ).toHaveFocus(),
    );
    await user.tab();
    expect(
      within(dialog).getByRole("button", { name: "Đăng xuất" }),
    ).toHaveFocus();
    await user.tab();
    expect(
      within(dialog).getByRole("button", { name: "Đóng tài khoản" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(router.state.location.pathname).toBe("/admin/organizations");
  });

  it("logs out through the existing session boundary and clears admin cache", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      MOCK_SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: "mock-admin",
        role: "admin",
        token: "00000000-0000-4000-8000-000000000010",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    );
    const { router, client } = renderAdminLayout();
    client.setQueryData(["admin", "organizations"], { private: "mock" });
    await user.click(screen.getByRole("button", { name: "Tài khoản" }));
    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBeNull();
    expect(client.getQueryData(["admin", "organizations"])).toBeUndefined();
    expect(router.state.location.pathname).toBe("/login");
  });
  it("AdminLayout renders the official BLUE logo in the header", () => {
    renderAdminLayout();
    const logoLink = screen.getByRole("link", { name: "BLUE — Quản trị" });
    expect(within(logoLink).getByRole("img", { name: "BLUE" })).toHaveAttribute(
      "src",
      expect.stringContaining("blue-official-logo.png"),
    );
  });

  it("AdminLayout renders all five canonical admin links with an active item", () => {
    renderAdminLayout();

    const navigation = screen.getByRole("navigation", {
      name: "Điều hướng quản trị",
    });
    for (const [name, href] of [
      ["Tổ chức", "/admin/organizations"],
      ["Nhân viên", "/admin/staff"],
      ["Đơn đặt vé", "/admin/bookings"],
      ["Thanh toán", "/admin/payments"],
      ["Hoàn tiền", "/admin/refunds"],
    ]) {
      expect(within(navigation).getByRole("link", { name })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(
      within(navigation).getByRole("link", { name: "Tổ chức" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("main")).toHaveTextContent("Nội dung quản trị");
  });

  it("AdminLayout keeps its parent section active for detail routes", () => {
    renderAdminLayout("/admin/refunds/REF-1");

    expect(screen.getByRole("link", { name: "Hoàn tiền" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Tổ chức" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("link", { name: "Đến nội dung quản trị" }),
    ).toHaveAttribute("href", "#admin-main-content");
    expect(screen.getByRole("main")).toHaveAttribute(
      "id",
      "admin-main-content",
    );
  });

  it("AdminLayout opens by keyboard, traps focus and returns it on Escape", async () => {
    const user = userEvent.setup();
    renderAdminLayout();
    const trigger = screen.getByRole("button", { name: "Mở menu quản trị" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    trigger.focus();
    await user.keyboard("{Enter}");

    const dialog = screen.getByRole("dialog", { name: "Menu quản trị" });
    expect(dialog).toHaveAccessibleDescription(
      "Điều hướng các khu vực quản trị BLUE.",
    );
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const close = within(dialog).getByRole("button", {
      name: "Đóng menu quản trị",
    });
    await waitFor(() => expect(close).toHaveFocus());
    expect(within(dialog).getAllByRole("link")).toHaveLength(5);
    await user.tab({ shift: true });
    expect(
      within(dialog).getByRole("link", { name: "Hoàn tiền" }),
    ).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("AdminLayout closes its dialog from the close button", async () => {
    const user = userEvent.setup();
    renderAdminLayout();
    const trigger = screen.getByRole("button", { name: "Mở menu quản trị" });
    await user.click(trigger);
    await user.click(
      screen.getByRole("button", { name: "Đóng menu quản trị" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("AdminLayout closes the drawer after navigating and updates active section", async () => {
    const user = userEvent.setup();
    renderAdminLayout();
    await user.click(screen.getByRole("button", { name: "Mở menu quản trị" }));
    const dialog = screen.getByRole("dialog", { name: "Menu quản trị" });
    await user.click(within(dialog).getByRole("link", { name: "Thanh toán" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Thanh toán" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Tổ chức" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("AdminLayout closes an open drawer only when entering desktop width", async () => {
    const user = userEvent.setup();
    renderAdminLayout();
    await user.click(screen.getByRole("button", { name: "Mở menu quản trị" }));
    act(() => desktopQuery.addEventListener.mock.calls[0]?.[1]());
    expect(screen.getByRole("dialog", { name: "Menu quản trị" })).toBeVisible();

    act(() => {
      desktopQuery.matches = true;
      desktopQuery.addEventListener.mock.calls[0]?.[1]();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
