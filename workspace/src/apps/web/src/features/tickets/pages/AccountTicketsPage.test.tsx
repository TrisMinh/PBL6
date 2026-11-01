import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerSessionRoute } from "@/app/guards/CustomerSessionRoute";
import { httpAuthRepository } from "@/features/auth/repositories/httpAuthRepository";
import { writeMockSession } from "@/features/auth/lib/sessionStorage";
import { MOCK_SESSION_STORAGE_KEY } from "@/features/auth/config/session";
import type { MockSession } from "@/features/auth/types/auth";
import { AccountTicketsPage } from "@/features/tickets/pages/AccountTicketsPage";
import { TicketDetailPage } from "@/features/tickets/pages/TicketDetailPage";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { issueTestTickets } from "@/test/tickets";
import { httpCancellationRepository } from "@/features/cancellation/repositories/httpCancellationRepository";
import { httpTicketRepository } from "@/features/tickets/repositories/httpTicketRepository";

beforeEach(() => {
  mockDb.reset();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
async function login(
  email = "test+review@example.invalid",
): Promise<MockSession> {
  const session = await httpAuthRepository.login({
    email,
    password: "BlueDemo2026",
  });
  writeMockSession(session);
  return session;
}
function LoginProbe(): ReactElement {
  const { state } = useLocation();
  return (
    <>
      <h1>Đăng nhập</h1>
      <p>{state?.from}</p>
    </>
  );
}
function mount(path = "/account/tickets"): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<CustomerSessionRoute />}>
            <Route path="/account/tickets" element={<AccountTicketsPage />} />
          </Route>
          <Route path="/tickets/:ticketCode" element={<TicketDetailPage />} />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
describe("customer account tickets", () => {
  it("missing session redirects to login with a safe intended path", async () => {
    mount();
    expect(
      await screen.findByRole("heading", { name: "Đăng nhập" }),
    ).toBeVisible();
    expect(screen.getByText("/account/tickets")).toBeVisible();
  });
  it("admin cannot access customer history", async () => {
    await login("admin@blue.example.invalid");
    mount();
    expect(await screen.findByText(/403/)).toBeVisible();
  });
  it("empty history gives search recovery with only issued filter", async () => {
    await login();
    mount();
    expect(
      await screen.findByText("Bạn chưa có vé đã phát hành."),
    ).toBeVisible();
    expect(screen.getByLabelText("Trạng thái vé")).toHaveValue("issued");
    expect(screen.getByRole("link", { name: "Tìm chuyến" })).toHaveAttribute(
      "href",
      "/",
    );
  });
  it("lists owned issued tickets and account-authorized detail survives refresh", async () => {
    await issueTestTickets();
    await login();
    const client = mount();
    const links = await screen.findAllByRole("link", { name: /Xem vé BLUE/ });
    expect(links).toHaveLength(2);
    fireEvent.click(links[0]);
    expect(await screen.findByText("Khách Một")).toBeVisible();
    expect(
      screen.getByText("Minh họa mã vé — không dùng để quét"),
    ).toBeVisible();
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ),
    ).not.toContain(
      JSON.parse(sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY) ?? "{}")
        .token,
    );
    const href = links[0].getAttribute("href");
    cleanup();
    mount(href ?? "/");
    expect(await screen.findByText("Khách Một")).toBeVisible();
  });
  it("filters cancelled tickets and keeps the other ticket issued after refresh", async () => {
    const issued = await issueTestTickets();
    const access = await httpTicketRepository.lookup({
      bookingCode: issued.bookingCode,
      verificationValue: "test+review@example.invalid",
    });
    await httpCancellationRepository.cancel(
      issued.bookingCode,
      [issued.tickets[0].ticketId],
      "history-cancel",
      { kind: "guest", token: access.token },
    );
    await login();
    mount();
    expect(await screen.findByText("1 vé")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Trạng thái vé"), {
      target: { value: "cancelled" },
    });
    expect(await screen.findByRole("article")).toHaveTextContent("Đã hủy");
    expect(screen.queryByRole("link", { name: "Hủy vé" })).toBeNull();
    cleanup();
    mount();
    fireEvent.change(await screen.findByLabelText("Trạng thái vé"), {
      target: { value: "cancelled" },
    });
    expect(await screen.findByRole("article")).toHaveTextContent("Đã hủy");
  });
  it("server denied session clears client token and account caches", async () => {
    await login();
    mockDb.authSessions.clear();
    const client = mount();
    expect(
      await screen.findByRole("heading", { name: "Đăng nhập" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBeNull(),
    );
    expect(
      client.getQueryCache().findAll({ queryKey: ["account-tickets"] }),
    ).toHaveLength(0);
  });
  it("history error retries safely without raw body", async () => {
    await login();
    server.use(
      http.get("/api/v1/me/tickets", () =>
        HttpResponse.text("PRIVATE_TEST", { status: 503 }),
      ),
    );
    mount();
    expect(await screen.findByText("Chưa thể tải danh sách vé")).toBeVisible();
    expect(screen.queryByText("PRIVATE_TEST")).toBeNull();
    server.resetHandlers();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(
      await screen.findByText("Bạn chưa có vé đã phát hành."),
    ).toBeVisible();
  });
  it("loading is accessible and expiry clears passenger/cache/token", async () => {
    await issueTestTickets();
    await login();
    server.use(
      http.get("/api/v1/me/tickets", async () => {
        await delay(50);
        return undefined;
      }),
    );
    const client = mount();
    expect(await screen.findByText("Đang tải danh sách vé…")).toBeVisible();
    await screen.findAllByRole("link", { name: /Xem vé BLUE/ });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 3_600_001);
    act(() => window.dispatchEvent(new Event("focus")));
    vi.useRealTimers();
    expect(
      await screen.findByRole("heading", { name: "Đăng nhập" }),
    ).toBeVisible();
    expect(screen.queryByText("Khách Một")).toBeNull();
    await waitFor(() =>
      expect(
        client.getQueryCache().findAll({ queryKey: ["account-tickets"] }),
      ).toHaveLength(0),
    );
  });
});
