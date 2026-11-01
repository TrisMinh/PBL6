import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TICKET_ACCESS_STORAGE_KEY,
  TICKET_DETAIL_QUERY_KEY,
} from "@/features/tickets/config/access";
import { TicketDetailPage } from "@/features/tickets/pages/TicketDetailPage";
import { httpTicketRepository } from "@/features/tickets/repositories/httpTicketRepository";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { issueTestTickets } from "@/test/tickets";

beforeEach(() => {
  mockDb.reset();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function mount(code = "BLUE-UNKNOWN"): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/tickets/${code}`]}>
        <Routes>
          <Route path="/tickets/:ticketCode" element={<TicketDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
async function grant(): Promise<string> {
  const issued = await issueTestTickets(),
    access = await httpTicketRepository.lookup({
      bookingCode: issued.bookingCode,
      verificationValue: "test+review@example.invalid",
    });
  sessionStorage.setItem(TICKET_ACCESS_STORAGE_KEY, JSON.stringify(access));
  return access.ticketCodes[0];
}
describe("TicketDetailPage access and projection", () => {
  it("never fetches ticket from code alone and offers lookup instead of granting from payment", async () => {
    let requests = 0;
    server.use(
      http.get("/api/v1/tickets/:code", () => {
        requests++;
        return undefined;
      }),
    );
    mount();
    expect(
      await screen.findByRole("link", { name: "Tra cứu vé" }),
    ).toHaveAttribute("href", "/tickets/lookup");
    expect(screen.queryByText("Khách Một")).toBeNull();
    expect(requests).toBe(0);
  });
  it("renders trusted one-seat issued ticket, passenger, journey, payment and labelled mock marker", async () => {
    const code = await grant();
    mount(code);
    expect(
      await screen.findByRole("heading", { name: "Vé điện tử" }),
    ).toBeVisible();
    expect(await screen.findByText("Khách Một")).toBeVisible();
    expect(screen.getByText("A01", { exact: true })).toBeVisible();
    expect(screen.getByText("BLUE Express")).toBeVisible();
    expect(screen.getByText(/không dùng để quét/)).toBeVisible();
    expect(screen.queryByText(/00000007-0000-4000/)).toBeNull();
    expect(screen.queryByText(/test\+review|0912345678|0987654321/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Tải vé PDF|Chia sẻ/ }),
    ).toBeNull();
    cleanup();
    mount(code);
    expect(await screen.findByText("Khách Một")).toBeVisible();
  });
  it("uses the exact local ticket assets and bounded presentation-only QR", async () => {
    const code = await grant();
    mount(code);
    expect(await screen.findByText("QUÉT KHI LÊN XE")).toBeVisible();
    const marker = screen.getByRole("img", {
      name: "Mã vé minh họa, không dùng để quét",
    });
    expect(marker).toHaveAttribute(
      "src",
      expect.stringMatching(/ticket-qr\.png$/),
    );
    expect(marker).toHaveAttribute("data-presentation-only", "true");
    expect(screen.getByText("Sẵn sàng để quét")).toBeVisible();
  });
  it("keeps loading and safe error retry without raw server content", async () => {
    const code = await grant();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get("/api/v1/tickets/:code", async () => {
        await held;
        return HttpResponse.json({ message: "PRIVATE_TEST" }, { status: 503 });
      }),
    );
    mount(code);
    expect(await screen.findByRole("status")).toHaveTextContent("Đang tải vé");
    release();
    expect(
      await screen.findByRole("button", { name: "Thử lại" }),
    ).toBeVisible();
    expect(screen.queryByText("PRIVATE_TEST")).toBeNull();
    server.resetHandlers();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Khách Một")).toBeVisible();
  });
  it("removes passenger UI, token and detail cache after focus expiry", async () => {
    const code = await grant();
    vi.useFakeTimers({ toFake: ["Date"] });
    const client = mount(code);
    await screen.findByText("Khách Một");
    const access = JSON.parse(
      sessionStorage.getItem(TICKET_ACCESS_STORAGE_KEY) ?? "{}",
    );
    vi.setSystemTime(Date.parse(access.expiresAt));
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(screen.queryByText("Khách Một")).toBeNull());
    expect(
      await screen.findByRole("link", { name: "Tra cứu vé" }),
    ).toBeVisible();
    expect(sessionStorage.getItem(TICKET_ACCESS_STORAGE_KEY)).toBeNull();
    expect(
      client.getQueriesData({ queryKey: [TICKET_DETAIL_QUERY_KEY] }),
    ).toEqual([]);
  });
  it.each([401, 410])(
    "revokes locally plausible access rejected by authoritative server %s",
    async (status) => {
      const code = await grant();
      server.use(
        http.get("/api/v1/tickets/:code", () =>
          HttpResponse.json(
            { code: status === 401 ? "ACCESS_REQUIRED" : "LOOKUP_EXPIRED" },
            { status },
          ),
        ),
      );
      mount(code);
      await waitFor(() =>
        expect(screen.getByRole("link", { name: "Tra cứu vé" })).toBeVisible(),
      );
      await waitFor(() =>
        expect(sessionStorage.getItem(TICKET_ACCESS_STORAGE_KEY)).toBeNull(),
      );
    },
  );
  it("recovers unknown scoped ticket without rendering private data", async () => {
    const code = await grant();
    server.use(
      http.get("/api/v1/tickets/:code", () =>
        HttpResponse.json({ code: "NOT_FOUND" }, { status: 404 }),
      ),
    );
    mount(code);
    expect(
      await screen.findByRole("heading", {
        name: "Không tìm thấy vé",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Tra cứu vé" })).toHaveAttribute(
      "href",
      "/tickets/lookup",
    );
  });
  it.each([401, 410])(
    "revokes denied HTTP%s access even when Problem Details JSON is malformed",
    async (status) => {
      const code = await grant();
      server.use(
        http.get(
          "/api/v1/tickets/:code",
          () => new HttpResponse("PRIVATE_TEST", { status }),
        ),
      );
      mount(code);
      await waitFor(() =>
        expect(screen.getByRole("link", { name: "Tra cứu vé" })).toBeVisible(),
      );
      expect(sessionStorage.getItem(TICKET_ACCESS_STORAGE_KEY)).toBeNull();
      expect(screen.queryByText("PRIVATE_TEST")).toBeNull();
    },
  );
});
