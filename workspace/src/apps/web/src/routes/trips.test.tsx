import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { AppProviders } from "@/app/AppProviders";
import TripsRoute, { meta } from "@/routes/trips";

describe("trips route", () => {
  it("keeps generic public metadata without an extra loader request", () => {
    expect(meta()).toEqual([
      { title: "Tìm chuyến | BLUE" },
      {
        name: "description",
        content: "Tìm chuyến xe phù hợp với hành trình của bạn.",
      },
    ]);
  });
  it("delegates missing search to the accessible Results validation state", () => {
    const router = createMemoryRouter(
      [{ path: "/trips", element: <TripsRoute /> }],
      { initialEntries: ["/trips"] },
    );
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(
      screen.getByRole("heading", { name: "Thông tin tìm kiếm chưa hợp lệ" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Tìm lại chuyến" }),
    ).toHaveAttribute("href", "/");
  });
});
