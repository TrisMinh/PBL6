import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { ErrorBoundary, links } from "@/root";

describe("links", () => {
  it("serves the approved font families locally and preloads Vietnamese navigation text", () => {
    const css = readFileSync(resolve("src/styles/fonts.css"), "utf8");
    for (const family of [
      "Be Vietnam Pro",
      "Bricolage Grotesque",
      "Newsreader",
    ])
      expect(css).toContain(`font-family: '${family}'`);
    expect(css).toContain("/* vietnamese */");
    expect(css).not.toMatch(/https?:/);
    for (const url of css.matchAll(/url\(([^)]+)\)/g))
      expect(statSync(resolve(`public${url[1]}`)).size).toBeGreaterThan(0);
    expect(links()).toContainEqual(
      expect.objectContaining({
        rel: "preload",
        as: "font",
        href: "/fonts/be-vietnam-pro-600-vietnamese.woff2",
      }),
    );
    expect(
      links().every(
        (link) => "href" in link && link.href?.startsWith("/fonts/"),
      ),
    ).toBe(true);
  });
});

describe("ErrorBoundary", () => {
  it.each([
    [403, "Bạn không có quyền truy cập"],
    [404, "Không tìm thấy trang"],
    [500, "Không thể tải trang"],
  ])("provides safe recovery for status %i", (status, title) => {
    render(
      <MemoryRouter>
        <ErrorBoundary
          error={{
            status,
            statusText: "private details",
            internal: false,
            data: "private payload",
          }}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: title, level: 1 }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.queryByText(/private/)).not.toBeInTheDocument();
  });

  it("never exposes an unknown error message or stack", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary error={new Error("private stack and message")} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Không thể tải trang" }),
    ).toBeVisible();
    expect(screen.queryByText(/private stack/)).not.toBeInTheDocument();
    expect(document.querySelector("pre")).not.toBeInTheDocument();
  });
});
