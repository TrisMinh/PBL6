import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
vi.mock("./operatorWorkspace", async () => {
  const actual = await vi.importActual<typeof import("./operatorWorkspace")>(
    "./operatorWorkspace",
  );
  return {
    ...actual,
    readWorkspace: vi.fn().mockRejectedValue(Error("Máy chủ từ chối truy cập")),
    getSettlements: vi
      .fn()
      .mockRejectedValue(Error("Máy chủ đối soát không khả dụng")),
  };
});
import { OrganizationPage } from "./OrganizationPage";
import { SettlementsPage } from "./SettlementsPage";
it("keeps the organization layout and shows a real API failure", async () => {
  render(
    <MemoryRouter>
      <OrganizationPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "Tổ chức & thành viên" }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Máy chủ từ chối truy cập",
    ),
  );
});
it("reports a settlement failure instead of seeded rows", async () => {
  render(
    <MemoryRouter>
      <SettlementsPage />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(
      screen.getByText("Máy chủ đối soát không khả dụng"),
    ).toBeInTheDocument(),
  );
});
