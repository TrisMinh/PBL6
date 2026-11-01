import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { http, HttpResponse, delay } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TICKET_ACCESS_STORAGE_KEY } from "@/features/tickets/config/access";
import { TicketLookupPage } from "@/features/tickets/pages/TicketLookupPage";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { issueTestTickets } from "@/test/tickets";

beforeEach(() => {
  mockDb.reset();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function Destination(): ReactElement {
  const location = useLocation();
  return (
    <p>
      Destination {location.pathname}
      {location.search}
    </p>
  );
}
function mount(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/tickets/lookup"]}>
        <Routes>
          <Route path="/tickets/lookup" element={<TicketLookupPage />} />
          <Route path="/tickets/:ticketCode" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
function fill(code: string, proof = "test+review@example.invalid"): void {
  fireEvent.change(screen.getByLabelText("Mã đặt vé"), {
    target: { value: code },
  });
  fireEvent.change(
    screen.getByLabelText("Email hoặc số điện thoại đã đặt vé"),
    { target: { value: proof } },
  );
}
describe("TicketLookupPage", () => {
  it("labels body-only fields and validates required/invalid proof without network", async () => {
    let requests = 0;
    server.use(
      http.post("/api/v1/tickets/lookup", () => {
        requests++;
        return undefined;
      }),
    );
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Tra cứu vé" }));
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    fill("BLUE-ABC", "not-a-proof");
    fireEvent.click(screen.getByRole("button", { name: "Tra cứu vé" }));
    await waitFor(() =>
      expect(
        screen.getByLabelText("Email hoặc số điện thoại đã đặt vé"),
      ).toHaveAttribute("aria-invalid", "true"),
    );
    expect(requests).toBe(0);
  });
  it("locks rapid submit, stores only access, navigates canonical code with no proof/token URL or mutation variables", async () => {
    const issued = await issueTestTickets();
    let requests = 0;
    const urls: string[] = [];
    server.use(
      http.post("/api/v1/tickets/lookup", async ({ request }) => {
        requests++;
        urls.push(request.url);
        await delay(40);
        return undefined;
      }),
    );
    const client = mount();
    fill(issued.bookingCode.toLowerCase());
    const button = screen.getByRole("button", {
      name: "Tra cứu vé",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByText(
      `Destination /tickets/${issued.tickets[0].ticketCode}`,
    );
    expect(requests).toBe(1);
    const raw = sessionStorage.getItem(TICKET_ACCESS_STORAGE_KEY) ?? "";
    expect(raw).toContain(issued.tickets[0].ticketCode);
    expect(raw).not.toContain("test+review");
    expect(
      urls.every(
        (url) =>
          !url.includes("verificationValue") && !url.includes("test+review"),
      ),
    ).toBe(true);
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((m) => m.state.variables),
      ),
    ).not.toContain("test+review");
  });
  it("shows generic not-found without echoing proof and preserves a prior access on failure", async () => {
    const issued = await issueTestTickets();
    sessionStorage.setItem(TICKET_ACCESS_STORAGE_KEY, "prior-access");
    mount();
    fill(issued.bookingCode, "test+wrong@example.invalid");
    fireEvent.click(screen.getByRole("button", { name: "Tra cứu vé" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không tìm thấy vé",
    );
    expect(screen.queryByText(/test\+wrong/)).toBeNull();
    expect(sessionStorage.getItem(TICKET_ACCESS_STORAGE_KEY)).toBe(
      "prior-access",
    );
  });
  it("supports explicit retry after network failure", async () => {
    const issued = await issueTestTickets();
    server.use(
      http.post("/api/v1/tickets/lookup", () =>
        HttpResponse.json({ detail: "PRIVATE_TEST" }, { status: 503 }),
      ),
    );
    mount();
    fill(issued.bookingCode);
    fireEvent.click(screen.getByRole("button", { name: "Tra cứu vé" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chưa thể tra cứu",
    );
    expect(screen.queryByText("PRIVATE_TEST")).toBeNull();
    server.resetHandlers();
    fireEvent.click(screen.getByRole("button", { name: "Tra cứu vé" }));
    await screen.findByText(
      `Destination /tickets/${issued.tickets[0].ticketCode}`,
    );
  });
  it("refuses storage denial safely instead of navigating with missing refresh access", async () => {
    const issued = await issueTestTickets();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    mount();
    fill(issued.bookingCode);
    fireEvent.click(screen.getByRole("button", { name: "Tra cứu vé" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chưa thể lưu phiên tra cứu",
    );
    expect(screen.queryByText(/Destination/)).toBeNull();
  });
  it("aborts on unmount and suppresses late storage/navigation", async () => {
    const issued = await issueTestTickets();
    let request: Request | undefined,
      release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post("/api/v1/tickets/lookup", async (args) => {
        request = args.request;
        await held;
        return undefined;
      }),
    );
    mount();
    fill(issued.bookingCode);
    fireEvent.click(screen.getByRole("button", { name: "Tra cứu vé" }));
    await waitFor(() => expect(request).toBeDefined());
    cleanup();
    expect(request?.signal.aborted).toBe(true);
    release();
    expect(sessionStorage.getItem(TICKET_ACCESS_STORAGE_KEY)).toBeNull();
  });
});
