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
  it("opens the all-trips catalogue when route search parameters are absent", () => {
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
      screen.getByRole("heading", { name: "Tất cả chuyến xe" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Bộ lọc và sắp xếp" }),
    ).toBeInTheDocument();
  });
});
