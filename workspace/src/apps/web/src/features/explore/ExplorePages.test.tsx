import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { server } from "@/mocks/server";
import { ExplorePage, ProvincePage } from "@/features/explore/ExplorePages";

function renderPage(page: ReactElement): void {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("Explore pages", () => {
  it("searches province names without accents and shows a recoverable empty result", async () => {
    const user = userEvent.setup();
    renderPage(<ExplorePage />);
    expect(
      await screen.findByRole("link", { name: /Lâm Đồng/ }),
    ).toHaveAttribute("href", "/explore/lam-dong");
    await user.type(
      screen.getByRole("searchbox", { name: "Tìm tỉnh, thành" }),
      "lam dong",
    );
    await user.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    expect(
      screen.getAllByRole("link", { name: /Xem điểm đón, trả/ }),
    ).toHaveLength(1);
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "khong co");
    await user.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    expect(
      screen.getByText("Không tìm thấy tỉnh, thành phù hợp"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    expect(
      screen.getAllByRole("link", { name: /Xem điểm đón, trả/ }),
    ).toHaveLength(4);
  });
  it("separates pickup and dropoff with operator and unverified-coordinate information", async () => {
    renderPage(<ProvincePage slug="lam-dong" />);
    const pickup = await screen.findByRole("region", { name: "Điểm đón" });
    const dropoff = screen.getByRole("region", { name: "Điểm trả" });
    expect(within(pickup).getAllByRole("article")).toHaveLength(2);
    expect(within(dropoff).getAllByRole("article")).toHaveLength(2);
    expect(within(pickup).getAllByText(/BLUE Express/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(/Chưa có tọa độ được xác minh/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Tất cả tỉnh, thành" }),
    ).toHaveAttribute("href", "/explore");
    expect(screen.getByText(/Dữ liệu mô phỏng/)).toBeVisible();
  });
  it("shows terminal unknown-province recovery", async () => {
    renderPage(<ProvincePage slug="unknown-province" />);
    expect(
      await screen.findByRole("heading", {
        name: "Không tìm thấy tỉnh, thành",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Thử lại" }),
    ).not.toBeInTheDocument();
  });
  it("shows loading and retries safe service failures", async () => {
    server.use(
      http.get(
        "/api/v1/explore/provinces",
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    const user = userEvent.setup();
    renderPage(<ExplorePage />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải");
    await screen.findByRole("button", { name: "Thử lại" });
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("link", { name: /Lâm Đồng/ })).toBeVisible();
  });
  it("shows an empty service catalog without inventing coverage", async () => {
    server.use(
      http.get("/api/v1/explore/provinces", () =>
        HttpResponse.json({ items: [] }),
      ),
    );
    renderPage(<ExplorePage />);
    expect(
      await screen.findByText("Chưa có tỉnh, thành để hiển thị"),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /Xem điểm đón, trả/ }),
    ).not.toBeInTheDocument();
  });
});
