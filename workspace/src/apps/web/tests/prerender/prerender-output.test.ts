import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("production prerender output", () => {
  it("contains the public home page content before JavaScript runs", async () => {
    const html = await readFile("build/client/index.html", "utf8");

    expect(html).toContain(
      "<title>Đặt vé xe online nhanh chóng | BLUE</title>",
    );
    expect(html).toContain(
      '<meta name="description" content="Tìm chuyến, chọn ghế và đặt vé xe trực tuyến cùng BLUE."',
    );
    expect(html).toContain("<main");
    expect(html).toContain("Mỗi hành trình");
    expect(html).toContain("đều thật giản đơn.");
    expect(html).toContain("Chuyến ngon mình chọn, ghế ngon mình chốt");
    expect(html).toContain("hero-bus");
    expect(html).toContain("Đang tải điểm đi và điểm đến…");
  });
});

it("keeps the SSR icon graph limited to explicit leaf modules", async () => {
  const server = await readFile("build/server/index.js", "utf8");
  expect(/from\s+["']@phosphor-icons\/react["']/.test(server)).toBe(false);
});
