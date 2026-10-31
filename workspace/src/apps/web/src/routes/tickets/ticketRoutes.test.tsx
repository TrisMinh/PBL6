import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/app/AppProviders";
import LookupRoute, { meta as lookupMeta } from "@/routes/tickets/lookup";
import DetailRoute, { meta as detailMeta } from "@/routes/tickets/detail";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
describe("ticket route composition", () => {
  it("lookup route renders the real labelled form with public safe metadata", () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <LookupRoute />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(screen.getByLabelText("Mã đặt vé")).toBeVisible();
    expect(lookupMeta()).toContainEqual({ title: "Tra cứu vé | BLUE" });
  });
  it("detail route gates access and retains static noindex metadata", async () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <DetailRoute />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(
      await screen.findByRole("link", { name: "Tra cứu vé" }),
    ).toHaveAttribute("href", "/tickets/lookup");
    expect(detailMeta()).toContainEqual({
      name: "robots",
      content: "noindex, nofollow",
    });
  });
});
