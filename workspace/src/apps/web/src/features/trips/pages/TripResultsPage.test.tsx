import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tripKeys } from "@/features/trips/api/tripQueryKeys";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { TripResultsPage } from "@/features/trips/pages/TripResultsPage";
import { trips } from "@/mocks/fixtures/trips";
import { server } from "@/mocks/server";

const core =
  "originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2";
const clients: QueryClient[] = [];
beforeEach(() =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  ),
);
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  useBookingDraftStore.getState().clearDraft();
  vi.unstubAllGlobals();
});

function renderResults(query = core): {
  client: QueryClient;
  router: ReturnType<typeof createMemoryRouter>;
} {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  clients.push(client);
  const router = createMemoryRouter(
    [
      { path: "/trips", element: <TripResultsPage /> },
      { path: "/", element: <h1>Trang chủ thử nghiệm</h1> },
    ],
    { initialEntries: [`/trips?${query}`] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, router };
}

function filters(): HTMLElement {
  return screen.getByRole("region", { name: "Bộ lọc chuyến" });
}
function operators(): string[] {
  return screen
    .getAllByRole("article")
    .map(
      (article) =>
        within(article).getByRole("heading", { level: 2 }).textContent ?? "",
    );
}

describe("TripResultsPage", () => {
  it("renders the complete Results frame with search summary, sidebar, six cards and pagination", async () => {
    renderResults();
    expect(
      await screen.findByRole("region", { name: "Tìm chuyến hiện tại" }),
    ).toBeVisible();
    expect(screen.getByRole("region", { name: "Bộ lọc chuyến" })).toBeVisible();
    expect(
      await screen.findByRole("list", { name: "Danh sách chuyến" }),
    ).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.getByText("24 kết quả")).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Phân trang kết quả chuyến" }),
    ).toBeVisible();
    expect(screen.getByText("Hiển thị 1–6 trong 24 chuyến")).toBeVisible();
  });

  it("renders every one of the six visible Figma cards with exact content", async () => {
    renderResults();
    const articles = await screen.findAllByRole("article");
    const expected = [
      [
        "BLUE Expres.",
        "Limousine 11 chỗ",
        "07:00",
        "13:30",
        "6 giờ 30",
        "Miền Đông mới",
        "Bến xe Đà Lạt",
        "Còn 6 ghế",
        "320.000 ₫",
      ],
      [
        "An Lạc",
        "Giường nằm 40 chỗ",
        "08:00",
        "14:15",
        "6 giờ 15",
        "Miền Đông mới",
        "Bến xe Đà Lạt",
        "Còn 12 ghế",
        "280.000 ₫",
      ],
      [
        "Thiên Việt",
        "Cabin 24 phòng",
        "09:30",
        "15:45",
        "6 giờ 15",
        "Bến xe Q.5",
        "Trung tâm Đà Lạt",
        "Còn 4 ghế",
        "390.000 ₫",
      ],
      [
        "Minh Châu",
        "Limousine 24 chỗ",
        "11:00",
        "17:20",
        "6 giờ 20",
        "Miền Đông mới",
        "Bến xe Đà Lạt",
        "Còn 9 ghế",
        "330.000 ₫",
      ],
      [
        "Cao Nguyên",
        "Limousine giường 34",
        "13:30",
        "20:00",
        "6 giờ 30",
        "Bến xe An Sương",
        "Bến xe Đà Lạt",
        "Còn 15 ghế",
        "275.000 ₫",
      ],
      [
        "Đồi Xanh",
        "Giường phòng 21",
        "22:00",
        "04:30",
        "6 giờ 30",
        "Miền Đông mới",
        "Trung tâm Đà Lạt",
        "Còn 7 ghế",
        "350.000 ₫",
      ],
    ];
    expect(articles).toHaveLength(expected.length);
    expected.forEach((copy, index) => {
      const article = articles[index];
      if (!article) throw new Error(`Missing result card ${index + 1}`);
      for (const text of copy)
        expect(within(article).getByText(text)).toBeVisible();
    });
  });

  it("derives route and search labels from a valid non-HCM/Dalat query", async () => {
    renderResults(
      "originId=loc-danang&destinationId=loc-hanoi&departureDate=2099-01-01&passengerCount=1",
    );
    expect(
      await screen.findByRole("heading", {
        name: "Chuyến xe Đà Nẵng → Hà Nội",
      }),
    ).toBeVisible();
    const summary = screen.getByRole("region", { name: "Tìm chuyến hiện tại" });
    expect(within(summary).getByText("Đà Nẵng")).toBeVisible();
    expect(within(summary).getByText("Hà Nội")).toBeVisible();
    expect(summary).not.toHaveTextContent("TP. Hồ Chí Minh");
    expect(summary).not.toHaveTextContent("Đà Lạt");
  });

  it("gives each visible sort action truthful semantics and canonical URLs", async () => {
    server.use(
      http.get("/api/v1/trips", () =>
        HttpResponse.json({ items: trips.slice(0, 6), total: 6 }),
      ),
    );
    const { router } = renderResults();
    await screen.findByText("6 kết quả");
    await userEvent.click(
      screen.getByRole("button", { name: "Giá thấp nhất" }),
    );
    await waitFor(() => expect(operators()[0]).toBe("Cao Nguyên"));
    expect(new URLSearchParams(router.state.location.search).get("sort")).toBe(
      "price-asc",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Khởi hành sớm" }),
    );
    await waitFor(() => expect(operators()[0]).toBe("BLUE Expres."));
    expect(new URLSearchParams(router.state.location.search).get("sort")).toBe(
      "departure",
    );
    await userEvent.click(screen.getByRole("button", { name: "Phù hợp nhất" }));
    await waitFor(() => expect(operators()[0]).toBe("BLUE Expres."));
    expect(new URLSearchParams(router.state.location.search).has("sort")).toBe(
      false,
    );
  });

  it("exposes an accessible numeric window through page four with unique records", async () => {
    const request = vi.fn();
    server.use(
      http.get("/api/v1/trips", () => {
        request();
        return HttpResponse.json({ items: trips.slice(0, 24), total: 24 });
      }),
    );
    renderResults();
    await screen.findByText("Hiển thị 1–6 trong 24 chuyến");
    const seen = new Set<string>();
    let previousFirstId = "";
    for (let page = 1; page <= 4; page++) {
      expect(
        screen.getByRole("button", { name: String(page), current: "page" }),
      ).toBeVisible();
      if (previousFirstId)
        await waitFor(() =>
          expect(screen.getAllByRole("article")[0]?.id).not.toBe(
            previousFirstId,
          ),
        );
      previousFirstId = screen.getAllByRole("article")[0]?.id ?? "";
      for (const article of screen.getAllByRole("article")) {
        expect(article.id).toMatch(/^trip-/);
        expect(seen.has(article.id)).toBe(false);
        seen.add(article.id);
      }
      if (page < 4)
        await userEvent.click(
          screen.getByRole("button", { name: "Trang sau" }),
        );
    }
    expect(seen.size).toBe(24);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    "",
    core.replace("destinationId=loc-dalat", "destinationId=loc-hcm"),
    core.replace("2099-01-01", "2020-01-01"),
    core.replace("passengerCount=2", "passengerCount=7"),
    core + "&originId=loc-danang",
    core + "&sort=bad",
    core + "&sort=departure&sort=price-asc",
  ])("blocks invalid core query before any request: %s", async (query) => {
    const request = vi.fn();
    server.use(
      http.get("/api/v1/trips", () => {
        request();
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    renderResults(query);
    expect(
      screen.getByRole("heading", {
        name: "Thông tin tìm kiếm chưa hợp lệ",
        level: 1,
      }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("link", { name: "Tìm lại chuyến" }));
    expect(
      await screen.findByRole("heading", { name: "Trang chủ thử nghiệm" }),
    ).toBeVisible();
    expect(request).not.toHaveBeenCalled();
  });

  it("shows an accessible loading state while the real hook request is pending", async () => {
    server.use(
      http.get("/api/v1/trips", async () => {
        await delay(80);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    renderResults();
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải chuyến");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      await screen.findByRole("heading", {
        name: "Không tìm thấy chuyến phù hợp",
      }),
    ).toBeVisible();
  });

  it("shows safe server error with retry, then recovers through MSW without exposing raw text", async () => {
    let requests = 0;
    server.use(
      http.get("/api/v1/trips", () => {
        requests++;
        return requests === 1
          ? HttpResponse.json(
              { detail: "PRIVATE_SERVER_STACK" },
              { status: 503 },
            )
          : HttpResponse.json({ items: trips.slice(0, 4), total: 4 });
      }),
    );
    renderResults();
    expect(
      await screen.findByRole("heading", { name: "Không thể tải chuyến" }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent("PRIVATE_SERVER_STACK");
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("4 chuyến phù hợp")).toBeVisible();
    expect(requests).toBe(2);
  });

  it("handles schema drift with a safe recoverable error", async () => {
    server.use(
      http.get("/api/v1/trips", () =>
        HttpResponse.json({ items: [{ secret: "PRIVATE_PAYLOAD" }], total: 1 }),
      ),
    );
    renderResults();
    expect(
      await screen.findByRole("heading", { name: "Không thể tải chuyến" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeEnabled();
    expect(document.body).not.toHaveTextContent("PRIVATE_PAYLOAD");
  });

  it("maps network failure to actionable safe connection copy", async () => {
    server.use(http.get("/api/v1/trips", () => HttpResponse.error()));
    renderResults();
    expect(
      await screen.findByRole("heading", { name: "Không thể tải chuyến" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Không thể kết nối. Kiểm tra kết nối của bạn và thử lại.",
      ),
    ).toBeVisible();
  });

  it("empty data offers edit search rather than the error retry action", async () => {
    renderResults(core.replace("2099-01-01", "2099-02-01"));
    expect(
      await screen.findByRole("heading", {
        name: "Không tìm thấy chuyến phù hợp",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Sửa tìm kiếm" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("button", { name: "Thử lại" }),
    ).not.toBeInTheDocument();
    expect(filters()).toBeVisible();
  });

  it("renders domain cards without creating a session or replacing a prior draft on initial load", async () => {
    const draft = {
      passengerCount: 2,
      sessionId: "existing-session",
      tripId: "existing-trip",
      selectedSeatIds: [],
      passengers: [],
      totalVnd: 0,
      expiresAt: "2099-01-01T10:00:00Z",
    };
    useBookingDraftStore.getState().setDraft(draft);
    const storedBeforeSelection = useBookingDraftStore.getState().draft;
    const persistedBeforeSelection =
      sessionStorage.getItem("blue-booking-draft");
    const booking = vi.fn();
    server.use(
      http.post("/api/v1/booking-sessions", () => {
        booking();
        return HttpResponse.json({});
      }),
    );
    const { client } = renderResults();
    expect(await screen.findByText("24 chuyến phù hợp")).toBeVisible();
    expect(
      screen.getByRole("list", { name: "Danh sách chuyến" }),
    ).toBeVisible();
    expect(operators()).toEqual([
      "BLUE Expres.",
      "An Lạc",
      "Thiên Việt",
      "Minh Châu",
      "Cao Nguyên",
      "Đồi Xanh",
    ]);
    const snapshot = client.getQueryData(
      tripKeys.search({
        originId: "loc-hcm",
        destinationId: "loc-dalat",
        departureDate: "2099-01-01",
        passengerCount: 2,
        sort: "relevance",
      }),
    );
    const before = JSON.stringify(snapshot);
    expect(booking).not.toHaveBeenCalled();
    expect(useBookingDraftStore.getState().draft).toBe(storedBeforeSelection);
    expect(sessionStorage.getItem("blue-booking-draft")).toBe(
      persistedBeforeSelection,
    );
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(screen.getAllByRole("article")).toHaveLength(6);
  });

  it("updates sort URL and list immutably, filters vehicle client-side, preserves core and resets both", async () => {
    const requests: string[] = [];
    server.use(
      http.get("/api/v1/trips", ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json({ items: trips.slice(0, 4), total: 4 });
      }),
    );
    const { client, router } = renderResults(core + "&extra=a&extra=b");
    await screen.findByText("4 chuyến phù hợp");
    const relevanceKey = tripKeys.search({
      originId: "loc-hcm",
      destinationId: "loc-dalat",
      departureDate: "2099-01-01",
      passengerCount: 2,
      sort: "relevance",
    });
    const original = JSON.stringify(client.getQueryData(relevanceKey));
    await userEvent.selectOptions(
      within(filters()).getByLabelText("Sắp xếp"),
      "price-asc",
    );
    await waitFor(() =>
      expect(operators()).toEqual([
        "An Lạc",
        "BLUE Expres.",
        "Minh Châu",
        "Thiên Việt",
      ]),
    );
    expect(
      new URLSearchParams(router.state.location.search).get("originId"),
    ).toBe("loc-hcm");
    await userEvent.selectOptions(
      within(filters()).getByLabelText("Loại xe"),
      "cabin-22",
    );
    await userEvent.click(
      within(filters()).getByRole("button", { name: "Áp dụng bộ lọc" }),
    );
    await screen.findByText("2 kết quả");
    expect(operators()).toEqual(["BLUE Expres.", "Thiên Việt"]);
    expect(requests).toHaveLength(2);
    expect(requests.every((url) => !url.includes("vehicleType"))).toBe(true);
    expect(JSON.stringify(client.getQueryData(relevanceKey))).toBe(original);
    await userEvent.click(
      within(filters()).getByRole("button", { name: "Đặt lại" }),
    );
    await screen.findByText("4 kết quả");
    expect(router.state.location.search).toBe("?" + core + "&extra=a&extra=b");
  });

  it("renders empty after vehicle filtering and lets reset recover without a new request", async () => {
    const request = vi.fn();
    server.use(
      http.get("/api/v1/trips", () => {
        request();
        return HttpResponse.json({ items: [trips[0]], total: 1 });
      }),
    );
    renderResults(core + "&vehicleType=sleeper-34");
    expect(
      await screen.findByRole("heading", {
        name: "Không tìm thấy chuyến phù hợp",
      }),
    ).toBeVisible();
    await userEvent.click(
      within(filters()).getByRole("button", { name: "Đặt lại" }),
    );
    expect(await screen.findByText("1 chuyến phù hợp")).toBeVisible();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
