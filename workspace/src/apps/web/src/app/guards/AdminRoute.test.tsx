import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminRoute } from "@/app/guards/AdminRoute";
import { MOCK_SESSION_STORAGE_KEY } from "@/features/auth/config/session";
import type { UserRole } from "@/features/auth/types/auth";

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

function renderAdminGuard(): void {
  const router = createMemoryRouter(
    [
      {
        element: <AdminRoute />,
        children: [
          {
            path: "/admin/organizations",
            element: <h1>Quản trị được bảo vệ</h1>,
          },
        ],
      },
      { path: "/login", element: <h1>Đăng nhập</h1> },
    ],
    { initialEntries: ["/admin/organizations"] },
  );
  render(<RouterProvider router={router} />);
}

function setSession(role: UserRole, expiresAt = "2099-01-01T00:00:00Z"): void {
  sessionStorage.setItem(
    MOCK_SESSION_STORAGE_KEY,
    JSON.stringify({ userId: "test-user", role, expiresAt }),
  );
}

describe("AdminRoute", () => {
  it("keeps only the canonical intended admin path for login", async () => {
    const router = createMemoryRouter(
      [
        {
          element: <AdminRoute />,
          children: [
            { path: "/admin/bookings/booking-1", element: <h1>Đơn</h1> },
          ],
        },
        { path: "/login", element: <h1>Đăng nhập</h1> },
      ],
      { initialEntries: ["/admin/bookings/booking-1?email=PRIVATE_TEST"] },
    );
    render(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Đăng nhập" });
    expect(router.state.location.state).toEqual({
      from: "/admin/bookings/booking-1",
    });
  });
  it("AdminRoute without a session redirects to login", async () => {
    renderAdminGuard();

    expect(
      await screen.findByRole("heading", { name: "Đăng nhập" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Quản trị được bảo vệ" }),
    ).not.toBeInTheDocument();
  });

  it("AdminRoute before hydration shows loading without accessing storage", () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    const html = renderToString(
      <MemoryRouter>
        <AdminRoute />
      </MemoryRouter>,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Đang kiểm tra phiên");
    expect(read).not.toHaveBeenCalled();
  });

  it("AdminRoute for a customer shows a recoverable forbidden state", () => {
    setSession("customer");
    renderAdminGuard();
    expect(
      screen.getByRole("heading", { name: "403 — Không có quyền truy cập" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("heading", { name: "Quản trị được bảo vệ" }),
    ).not.toBeInTheDocument();
  });

  it("AdminRoute for a valid admin renders the protected outlet", () => {
    setSession("admin");
    renderAdminGuard();
    expect(
      screen.getByRole("heading", { name: "Quản trị được bảo vệ" }),
    ).toBeVisible();
  });

  it("AdminRoute with an expired session redirects to login", async () => {
    setSession("admin", "2000-01-01T00:00:00Z");
    renderAdminGuard();
    expect(
      await screen.findByRole("heading", { name: "Đăng nhập" }),
    ).toBeVisible();
  });

  it("AdminRoute revalidates expiry after mount", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T00:00:00Z"));
    setSession("admin", "2026-10-19T00:00:01Z");
    renderAdminGuard();
    expect(
      screen.getByRole("heading", { name: "Quản trị được bảo vệ" }),
    ).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Quản trị được bảo vệ" }),
    ).not.toBeInTheDocument();
  });
});
