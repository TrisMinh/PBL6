import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { server } from "@/mocks/server";
import HomeRoute, { meta } from "@/routes/home";
import { ROUTES } from "@/shared/config/routes";

const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

function ResultsProbe(): ReactElement {
  const location = useLocation();
  return (
    <output aria-label="Kết quả điều hướng">
      {location.pathname}
      {location.search}
    </output>
  );
}

function renderHome(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ROUTES.home]}>
        <Routes>
          <Route path={ROUTES.home} element={<HomeRoute />} />
          <Route path={ROUTES.trips} element={<ResultsProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(
  originId: string,
  destinationId: string,
): Promise<void> {
  await screen.findByRole("form", { name: "Tìm chuyến" });
  await userEvent.selectOptions(screen.getByLabelText("Điểm đi"), originId);
  await userEvent.selectOptions(
    screen.getByLabelText("Điểm đến"),
    destinationId,
  );
  fireEvent.change(screen.getByLabelText("Ngày đi"), {
    target: { value: "2099-01-01" },
  });
  await userEvent.selectOptions(screen.getByLabelText("Hành khách"), "2");
  await userEvent.click(screen.getByRole("button", { name: "Tìm chuyến" }));
}

describe("HomeRoute", () => {
  it("keeps the content strategy public metadata", () => {
    expect(meta()).toEqual([
      { title: "Đặt vé xe online nhanh chóng | BLUE" },
      {
        name: "description",
        content: "Tìm chuyến, chọn ghế và đặt vé xe trực tuyến cùng BLUE.",
      },
    ]);
  });

  it("renders the hero then navigates within the SPA with four canonical params", async () => {
    renderHome();
    expect(
      screen.getByRole("heading", {
        name: "Mỗi hành trình đều thật giản đơn.",
      }),
    ).toBeInTheDocument();
    await fillAndSubmit("loc-hcm", "loc-dalat");
    const output = await screen.findByLabelText("Kết quả điều hướng");
    const url = new URL(output.textContent ?? "", "https://example.invalid");
    expect(url.pathname).toBe(ROUTES.trips);
    expect([...url.searchParams.entries()]).toEqual([
      ["originId", "loc-hcm"],
      ["destinationId", "loc-dalat"],
      ["departureDate", "2099-01-01"],
      ["passengerCount", "2"],
    ]);
  });

  it("renders every canonical Home section in Figma order", async () => {
    renderHome();
    await screen.findByRole("form", { name: "Tìm chuyến" });

    const orderedRegions = [
      screen.getByRole("heading", {
        name: "Mỗi hành trình đều thật giản đơn.",
      }),
      screen.getByRole("region", { name: "Cam kết dịch vụ" }),
      screen.getByRole("heading", { name: "Tuyến đường phổ biến" }),
      screen.getByRole("heading", {
        name: "An tâm trên từng chặng đường",
      }),
      screen.getByRole("heading", {
        name: "Kế hoạch thay đổi? Bạn vẫn kiểm soát hành trình.",
      }),
      screen.getByRole("contentinfo", { name: "Thông tin BLUE" }),
    ];

    for (let index = 1; index < orderedRegions.length; index += 1) {
      expect(
        orderedRegions[index - 1]?.compareDocumentPosition(
          orderedRegions[index] as Node,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.getAllByRole("article", { name: /→/ })).toHaveLength(4);
    expect(
      screen.getByRole("region", { name: "Danh sách tuyến đường phổ biến" }),
    ).toHaveAttribute("tabindex", "0");
    expect(screen.getAllByRole("img", { name: "BLUE" })).not.toHaveLength(0);
  });

  it("encodes IDs containing URL metacharacters without adding query keys", async () => {
    const origin = "mock &origin=/1";
    const destination = "mock ?destination=#2";
    server.use(
      http.get("/api/v1/locations", () =>
        HttpResponse.json({
          items: [
            {
              id: origin,
              name: "Điểm đi thử nghiệm",
              displayName: "Tỉnh A",
              province: "Tỉnh A",
            },
            {
              id: destination,
              name: "Điểm đến thử nghiệm",
              displayName: "Tỉnh B",
              province: "Tỉnh B",
            },
          ],
        }),
      ),
    );
    renderHome();
    await fillAndSubmit(origin, destination);
    const output = await screen.findByLabelText("Kết quả điều hướng");
    const params = new URL(output.textContent ?? "", "https://example.invalid")
      .searchParams;
    expect(params.get("originId")).toBe(origin);
    expect(params.get("destinationId")).toBe(destination);
    expect([...params.keys()]).toHaveLength(4);
  });

  it("does not navigate when the form has the same route", async () => {
    renderHome();
    await fillAndSubmit("loc-hcm", "loc-hcm");
    await waitFor(() =>
      expect(screen.getByLabelText("Điểm đến")).toHaveAccessibleDescription(
        "Điểm đến phải khác điểm đi.",
      ),
    );
    expect(
      screen.queryByLabelText("Kết quả điều hướng"),
    ).not.toBeInTheDocument();
  });
});
