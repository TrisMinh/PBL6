import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
      <QueryClientProvider client={new QueryClient()}>
        <OrganizationPage />
      </QueryClientProvider>
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
      <QueryClientProvider client={new QueryClient()}>
        <SettlementsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Chưa tải được đối soát. Hãy thử làm mới.",
  );
});
