import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import reactRouterConfig from "../../../react-router.config";
import { createMeta } from "@/shared/config/seo";

describe("createMeta", () => {
  it("adds the BLUE title suffix and description for an indexable page", () => {
    expect(
      createMeta({
        title: "Tìm chuyến",
        description: "Tìm chuyến xe phù hợp với hành trình của bạn.",
      }),
    ).toEqual([
      { title: "Tìm chuyến | BLUE" },
      {
        name: "description",
        content: "Tìm chuyến xe phù hợp với hành trình của bạn.",
      },
    ]);
  });

  it("adds the noindex policy for a private or transactional page", () => {
    expect(
      createMeta({
        title: "Chi tiết vé",
        description: "Xem thông tin vé đã đặt.",
        noIndex: true,
      }),
    ).toEqual([
      { title: "Chi tiết vé | BLUE" },
      { name: "description", content: "Xem thông tin vé đã đặt." },
      { name: "robots", content: "noindex, nofollow" },
    ]);
  });
});

describe("robots policy", () => {
  it("allows public pages and blocks private route families without inventing a sitemap URL", async () => {
    const robots = await readFile("public/robots.txt", "utf8");

    expect(robots).toContain("User-agent: *\nAllow: /");
    expect(robots).toContain("Disallow: /admin/");
    expect(robots).toContain("Disallow: /account/");
    expect(robots).toContain("Disallow: /booking/");
    expect(robots).toContain("Disallow: /bookings/");
    expect(robots).toContain("Disallow: /payment/");
    expect(robots).not.toMatch(/^Sitemap:/m);
  });

  it("keeps prerender limited to the stable public home route", () => {
    expect(reactRouterConfig.prerender).toEqual(["/"]);
  });
});
