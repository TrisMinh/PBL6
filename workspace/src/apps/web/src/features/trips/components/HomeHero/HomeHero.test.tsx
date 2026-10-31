import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";

import { HomeHero } from "@/features/trips/components/HomeHero/HomeHero";
import { locations } from "@/mocks/fixtures/locations";
import { server } from "@/mocks/server";

const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

function renderHero(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomeHero />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HomeHero", () => {
  it("renders the Figma copy, exact local bus image and live search form", async () => {
    renderHero();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Mỗi hành trình đều thật giản đơn.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Đặt vé rõ ràng - Đi xa nhẹ nhàng"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Chuyến ngon mình chọn, ghế ngon mình chốt"),
    ).toBeInTheDocument();
    const hero = screen.getByRole("region", {
      name: "Mỗi hành trình đều thật giản đơn.",
    });
    const image = hero.querySelector("img");
    expect(image).toHaveAttribute(
      "src",
      expect.stringContaining("hero-bus.png"),
    );
    expect(image).toHaveAttribute("alt", "");
    expect(await screen.findByRole("form", { name: "Tìm chuyến" })).toHaveClass(
      "search-form--with-leading-icon",
    );
    expect(
      within(screen.getByLabelText("Điểm đi")).getByRole("option", {
        name: `${locations[0].name} · ${locations[0].province}`,
      }),
    ).toBeInTheDocument();
  });

  it("shows accessible loading while the locations request is pending", async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get("/api/v1/locations", async () => {
        await held;
        return HttpResponse.json({ items: locations });
      }),
    );
    renderHero();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đang tải điểm đi và điểm đến…",
    );
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    release();
    expect(await screen.findByRole("form")).toBeInTheDocument();
  });

  it("offers retry on a safe locations error and recovers through MSW", async () => {
    server.use(
      http.get("/api/v1/locations", () =>
        HttpResponse.json({ detail: "private server detail" }, { status: 503 }),
      ),
    );
    renderHero();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể tải điểm đi và điểm đến. Vui lòng thử lại.",
    );
    expect(screen.queryByText("private server detail")).not.toBeInTheDocument();
    server.use(
      http.get("/api/v1/locations", () =>
        HttpResponse.json({ items: locations }),
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("form")).toBeInTheDocument();
  });

  it("keeps an empty collection distinct from an error", async () => {
    server.use(
      http.get("/api/v1/locations", () => HttpResponse.json({ items: [] })),
    );
    renderHero();
    expect(
      await screen.findByText(
        "Chưa có điểm đi và điểm đến. Vui lòng thử lại sau.",
      ),
    ).toHaveAttribute("role", "status");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
