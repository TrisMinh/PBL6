import type { RouteConfigEntry } from "@react-router/dev/routes";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { MemoryRouter, type MetaDescriptor } from "react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import routeConfig from "@/routes";
import { AppProviders } from "@/app/AppProviders";

interface PlaceholderModule {
  default: () => ReactElement;
  meta: () => MetaDescriptor[];
}

const modules = import.meta.glob<PlaceholderModule>(
  ["./routes/**/*.tsx", "!./routes/**/*.test.tsx"],
  { eager: true },
);

interface ManifestEntry {
  path: string;
  file: string;
  ancestors: string[];
}

function flattenRoutes(
  entries: RouteConfigEntry[],
  parentPath = "",
  ancestors: string[] = [],
): ManifestEntry[] {
  return entries.flatMap((entry) => {
    const path = [parentPath, entry.path]
      .filter(Boolean)
      .join("/")
      .replace(/\/{2,}/g, "/");
    if (entry.children)
      return flattenRoutes(entry.children, path, [...ancestors, entry.file]);
    return [
      {
        path: path.startsWith("/") ? path : `/${path}`,
        file: entry.file,
        ancestors,
      },
    ];
  });
}

describe("routeConfig", () => {
  it("routeConfig includes every canonical customer and admin path with the correct guards", () => {
    const routes = flattenRoutes(routeConfig).filter(
      ({ path }) => !path.startsWith("/operator/"),
    );
    expect(routes.map(({ path }) => path).sort()).toEqual(
      [
        "/",
        "/*",
        "/trips",
        "/explore",
        "/explore/:provinceSlug",
        "/login",
        "/register",
        "/forgot-password",
        "/verify-email",
        "/reset-password",
        "/tickets/lookup",
        "/account/tickets",
        "/tickets/:ticketCode",
        "/bookings/:bookingCode/cancel",
        "/booking/:sessionId/seats",
        "/booking/:sessionId/passengers",
        "/booking/:sessionId/review",
        "/payment/:bookingId/vnpay",
        "/payment/vnpay/return",
        "/admin/organizations",
        "/admin/organizations/:organizationId",
        "/admin/staff",
        "/admin/staff/:staffId",
        "/admin/bookings",
        "/admin/bookings/:bookingId",
        "/admin/payments",
        "/admin/payments/:paymentId",
        "/admin/refunds",
        "/admin/refunds/:refundId",
      ].sort(),
    );
    for (const entry of routes) {
      if (entry.path.startsWith("/admin/")) {
        expect(entry.ancestors).toEqual([
          "./routes/guards/admin.tsx",
          "./routes/layouts/admin.tsx",
        ]);
      } else {
        expect(entry.ancestors[0]).toBe("./routes/layouts/customer.tsx");
        expect(
          entry.ancestors.includes("./routes/guards/customer-session.tsx"),
        ).toBe(entry.path === "/account/tickets");
        const needsBookingSession =
          entry.path.startsWith("/booking/") ||
          entry.path === "/payment/:bookingId/vnpay";
        expect(
          entry.ancestors.includes("./routes/guards/booking-session.tsx"),
        ).toBe(needsBookingSession);
      }
    }
  });
});

describe.each(
  flattenRoutes(routeConfig).filter(
    ({ path }) => !path.startsWith("/operator/"),
  ),
)("$path module", ({ path, file }) => {
  it("exports a thin page with one matching heading, metadata and no fixture import", () => {
    const module = modules[file];
    expect(module).toBeDefined();
    if (!module) throw new Error(`Missing route module: ${file}`);
    const Page = module.default;
    expect(typeof Page).toBe("function");
    expect(typeof module.meta).toBe("function");
    render(
      <AppProviders>
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </AppProviders>,
    );
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    const metadata = module.meta();
    const title = metadata.find((item) => "title" in item);
    if (path === "/")
      expect(title).toEqual({ title: "Đặt vé xe online nhanh chóng | BLUE" });
    else if (path === "/booking/:sessionId/seats")
      expect(title).toEqual({ title: "Chọn ghế | BLUE" });
    else if (path === "/booking/:sessionId/passengers")
      expect(title).toEqual({ title: "Thông tin hành khách | BLUE" });
    else if (path === "/booking/:sessionId/review")
      expect(title).toEqual({ title: "Kiểm tra đặt vé | BLUE" });
    else if (path === "/payment/:bookingId/vnpay")
      expect(title).toEqual({ title: "Thanh toán qua VNPay | BLUE" });
    else if (path === "/payment/vnpay/return")
      expect(title).toEqual({ title: "Kết quả thanh toán | BLUE" });
    else if (path === "/tickets/:ticketCode")
      expect(title).toEqual({ title: "Chi tiết vé | BLUE" });
    else if (path === "/login")
      expect(title).toEqual({ title: "Đăng nhập | BLUE" });
    else if (path === "/register")
      expect(title).toEqual({ title: "Đăng ký | BLUE" });
    else if (path === "/forgot-password")
      expect(title).toEqual({ title: "Quên mật khẩu | BLUE" });
    else if (path === "/account/tickets")
      expect(title).toEqual({ title: "Vé của tôi | BLUE" });
    else if (path === "/trips")
      expect(title).toEqual({ title: "Tìm chuyến | BLUE" });
    else if (path === "/explore")
      expect(title).toEqual({ title: "Khám phá tỉnh thành | BLUE" });
    else if (path === "/explore/:provinceSlug")
      expect(title).toEqual({ title: "Điểm đón và điểm trả | BLUE" });
    else
      expect(title).toEqual(
        expect.objectContaining({
          title: expect.stringContaining(headings[0].textContent),
        }),
      );
    expect(metadata).toContainEqual(
      expect.objectContaining({
        name: "description",
        content: expect.any(String),
      }),
    );
    const isPublic = [
      "/",
      "/trips",
      "/tickets/lookup",
      "/explore",
      "/explore/:provinceSlug",
    ].includes(path);
    if (!isPublic)
      expect(metadata).toContainEqual({
        name: "robots",
        content: "noindex, nofollow",
      });
    else
      expect(metadata).not.toContainEqual(
        expect.objectContaining({ name: "robots" }),
      );
    const source = readFileSync(resolve("src", file), "utf8");
    expect(source).toContain('from "@/shared/config/seo"');
    expect(source).not.toMatch(/from\s+["'][^"']*(?:mocks|fixtures)/);
  });
});
