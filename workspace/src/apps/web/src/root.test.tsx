import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ErrorBoundary, links } from "@/root";

describe("links", () => {
  it("links loads the approved display and body font families", () => {
    const fontStylesheets = links().filter(
      (link) => "rel" in link && link.rel === "stylesheet",
    );
    expect(fontStylesheets).toHaveLength(1);
    expect(fontStylesheets[0]).toEqual(
      expect.objectContaining({
        href: expect.stringContaining("family=Be+Vietnam+Pro"),
      }),
    );
    expect(fontStylesheets[0]).toEqual(
      expect.objectContaining({
        href: expect.stringContaining("family=Bricolage+Grotesque"),
      }),
    );
    expect(links()).toContainEqual(
      expect.objectContaining({
        rel: "stylesheet",
        href: expect.stringContaining("family=Newsreader:wght@600"),
      }),
    );
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
