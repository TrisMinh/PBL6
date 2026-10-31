import { expect, test } from "@playwright/test";
import { AdminPage } from "./pages/AdminPage";

test.use({ viewport: { width: 1440, height: 900 } });
for (const item of [
  {
    url: "/admin/bookings",
    active: "Đơn đặt vé",
    activeColor: "#1F66E5",
    inactiveColor: "#3F536B",
    underline: "rgb(31, 102, 229)",
  },
  {
    url: "/admin/bookings/BK-260916-018",
    active: "Đơn đặt vé",
    activeColor: "black",
    inactiveColor: "black",
    underline: "rgb(0, 0, 0)",
  },
  {
    url: "/admin/payments",
    active: "Thanh toán",
    activeColor: "#1F66E5",
    inactiveColor: "black",
    underline: "rgb(31, 102, 229)",
  },
  {
    url: "/admin/refunds",
    active: "Hoàn tiền",
    activeColor: "#1F66E5",
    inactiveColor: "black",
    underline: "rgb(31, 102, 229)",
  },
  {
    url: "/admin/organizations",
    active: "Tổ chức",
    activeColor: "#1F66E5",
    inactiveColor: "#3F536B",
    underline: "rgb(31, 102, 229)",
  },
  {
    url: "/admin/staff",
    active: "Nhân viên",
    activeColor: "#1F66E5",
    inactiveColor: "#3F536B",
    underline: "rgb(31, 102, 229)",
  },
]) {
  test(`Task9 exact navigation family ${item.url}`, async ({
    page,
    request,
  }) => {
    await new AdminPage(page).login();
    await page.goto(item.url);
    await expect(page.locator(".admin-list-state--loading")).toHaveCount(0);
    const nav = page.getByRole("navigation", {
      name: "Điều hướng quản trị",
      exact: true,
    });
    const active = nav.getByRole("link", { name: item.active, exact: true });
    await expect(active).toHaveAttribute("aria-current", "page");
    await expect(active).toHaveCSS("border-bottom-color", item.underline);
    for (const [link, color] of [
      [active, item.activeColor],
      [
        nav.getByRole("link", {
          name: item.active === "Nhân viên" ? "Tổ chức" : "Nhân viên",
          exact: true,
        }),
        item.inactiveColor,
      ],
    ] as const) {
      const source = await link.locator("img:visible").getAttribute("src");
      expect(source).toBeTruthy();
      const svg = source?.startsWith("data:")
        ? source.slice(0, source.indexOf(",")).endsWith(";base64")
          ? Buffer.from(
              source.slice(source.indexOf(",") + 1),
              "base64",
            ).toString("utf8")
          : decodeURIComponent(source.slice(source.indexOf(",") + 1))
        : await (await request.get(source ?? "")).text();
      expect(
        [...svg.matchAll(/stroke=['"]([^'"]+)['"]/g)].map((match) => match[1]),
      ).toContain(color);
    }
  });
}
