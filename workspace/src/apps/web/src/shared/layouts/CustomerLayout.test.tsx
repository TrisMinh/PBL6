import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerLayout } from "@/shared/layouts/CustomerLayout";

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

function renderCustomerLayout(initialEntry = "/"): void {
  const router = createMemoryRouter(
    [
      {
        element: <CustomerLayout />,
        children: [
          { path: "/", element: <h1>Nội dung hành trình</h1> },
          { path: "/trips", element: <h1>Kết quả chuyến</h1> },
          { path: "/explore", element: <h1>Khám phá tỉnh thành</h1> },
          { path: "/explore/:provinceSlug", element: <h1>Điểm đón trả</h1> },
          {
            path: "/booking/:sessionId/seats",
            element: <h1>Chọn ghế</h1>,
          },
          {
            path: "/booking/:sessionId/passengers",
            element: <h1>Hành khách</h1>,
          },
          {
            path: "/booking/:sessionId/review",
            element: <h1>Kiểm tra đặt vé</h1>,
          },
          {
            path: "/booking/:sessionId/passengers/details",
            element: <h1>Chi tiết hành khách</h1>,
          },
          { path: "/tickets/lookup", element: <h1>Tra cứu vé</h1> },
          {
            path: "/bookings/:bookingCode/cancel",
            element: <h1>Hủy vé</h1>,
          },
          {
            path: "/bookings/:bookingCode/cancel/details",
            element: <h1>Chi tiết hủy vé</h1>,
          },
          { path: "/tickets/:ticketCode", element: <h1>Chi tiết vé</h1> },
          { path: "/payment/:bookingId/vnpay", element: <h1>VNPay</h1> },
          { path: "/payment/vnpay/return", element: <h1>Kết quả</h1> },
          { path: "/login", element: <h1>Đăng nhập</h1> },
          { path: "/register", element: <h1>Đăng ký</h1> },
          { path: "/forgot-password", element: <h1>Khôi phục</h1> },
          { path: "/login/help", element: <h1>Trợ giúp đăng nhập</h1> },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );
  render(<RouterProvider router={router} />);
}

describe("CustomerLayout", () => {
  it.each([
    ["/", "Trang chủ"],
    ["/trips?view=destinations", "Điểm đến"],
    ["/explore", "Khám phá"],
    ["/explore/lam-dong", "Khám phá"],
    ["/tickets/lookup", "Vé xe"],
  ])("owns exactly one active navigation item at %s", (path, label) => {
    renderCustomerLayout(path);
    const navigation = screen.getByRole("navigation", {
      name: "Điều hướng chính",
    });
    const active = within(navigation).getAllByRole("link", { current: "page" });
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAccessibleName(label);
  });
  it("CustomerLayout renders landmarks, skip target and canonical navigation", () => {
    renderCustomerLayout();

    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("link", { name: "BLUE — Trang chủ" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: "Đến nội dung chính" }),
    ).toHaveAttribute("href", "#main-content");
    const navigation = screen.getByRole("navigation", {
      name: "Điều hướng chính",
    });
    expect(
      within(navigation).getByRole("link", { name: "Khám phá" }),
    ).toHaveAttribute("href", "/explore");
    expect(
      within(navigation).getByRole("link", { name: "Vé xe" }),
    ).toHaveAttribute("href", "/tickets/lookup");
    expect(
      screen.getByRole("link", { name: "Hành trình của tôi" }),
    ).toHaveAttribute("href", "/account/tickets");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(
      within(main).getByRole("heading", { name: "Nội dung hành trình" }),
    ).toBeVisible();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("does not add the generic footer to the route-owned Results frame", () => {
    renderCustomerLayout("/trips");

    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("does not add the generic footer to the route-owned seat frame", () => {
    renderCustomerLayout("/booking/session-1/seats");

    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it.each(["/booking/session-1/passengers", "/booking/session-1/review"])(
    "does not add the generic footer to the exact route-owned frame %s",
    (path) => {
      renderCustomerLayout(path);

      expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    },
  );

  it("keeps the generic footer for a nested passenger-like route", () => {
    renderCustomerLayout("/booking/session-1/passengers/details");

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("suppresses the generic footer only for the exact cancellation frame", () => {
    renderCustomerLayout("/bookings/BLUE-ABC/cancel");

    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("keeps the generic footer for a nested cancellation-like route", () => {
    renderCustomerLayout("/bookings/BLUE-ABC/cancel/details");

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
  it.each([
    "/payment/booking-1/vnpay",
    "/payment/vnpay/return",
    "/tickets/BLUE-ABC",
  ])("suppresses the footer only for exact payment/ticket frame %s", (path) => {
    renderCustomerLayout(path);
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("uses the official logo in the generic footer on a generic customer route", () => {
    renderCustomerLayout("/tickets/lookup");

    expect(
      within(screen.getByRole("contentinfo")).getByRole("img", {
        name: "BLUE",
      }),
    ).toBeInTheDocument();
  });

  it.each(["/login", "/register", "/forgot-password"])(
    "lets the exact auth route own its complete frame at %s",
    (path) => {
      renderCustomerLayout(path);

      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
      expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
      expect(screen.getByRole("main")).toHaveClass(
        "customer-layout__main--route-owned",
      );
    },
  );

  it("keeps the customer shell on a nested auth-like route", () => {
    renderCustomerLayout("/login/help");

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("CustomerLayout opens its labelled menu by keyboard and restores focus on Escape", async () => {
    const user = userEvent.setup();
    renderCustomerLayout();

    const trigger = screen.getByRole("button", { name: "Mở menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    trigger.focus();
    await user.keyboard("{Enter}");

    const dialog = screen.getByRole("dialog", { name: "Menu BLUE" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(dialog).toHaveAccessibleDescription(
      "Tìm chuyến, tra cứu vé hoặc đăng nhập tài khoản.",
    );
    const closeButton = within(dialog).getByRole("button", {
      name: "Đóng menu",
    });
    await waitFor(() => expect(closeButton).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("CustomerLayout traps keyboard focus in the open drawer and closes from its button", async () => {
    const user = userEvent.setup();
    renderCustomerLayout();
    const trigger = screen.getByRole("button", { name: "Mở menu" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Menu BLUE" });
    const closeButton = within(dialog).getByRole("button", {
      name: "Đóng menu",
    });
    const lastLink = within(dialog).getByRole("link", { name: "Vé xe" });
    await waitFor(() => expect(closeButton).toHaveFocus());
    await user.tab({ shift: true });
    expect(lastLink).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.click(closeButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("CustomerLayout closes mobile navigation after following a canonical link", async () => {
    const user = userEvent.setup();
    renderCustomerLayout();
    await user.click(screen.getByRole("button", { name: "Mở menu" }));

    const dialog = screen.getByRole("dialog", { name: "Menu BLUE" });
    await user.click(within(dialog).getByRole("link", { name: "Khám phá" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Khám phá tỉnh thành");
    expect(screen.getByRole("link", { name: "Khám phá" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("CustomerLayout closes its drawer when the viewport becomes desktop", async () => {
    const user = userEvent.setup();
    renderCustomerLayout();
    await user.click(screen.getByRole("button", { name: "Mở menu" }));
    expect(screen.getByRole("dialog", { name: "Menu BLUE" })).toBeVisible();

    act(() => {
      desktopQuery.addEventListener.mock.calls[0]?.[1]();
    });
    expect(screen.getByRole("dialog", { name: "Menu BLUE" })).toBeVisible();

    act(() => {
      desktopQuery.matches = true;
      desktopQuery.addEventListener.mock.calls[0]?.[1]();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
