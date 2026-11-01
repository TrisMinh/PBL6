import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CancellationPage } from "@/features/cancellation/pages/CancellationPage";
import { httpTicketRepository } from "@/features/tickets/repositories/httpTicketRepository";
import { ticketAccessStorage } from "@/features/tickets/lib/ticketAccessStorage";
import { mockDb } from "@/mocks/state/mockDb";
import { issueTestTickets } from "@/test/tickets";

beforeEach(() => {
  mockDb.reset();
  sessionStorage.clear();
});
afterEach(() => cleanup());

function mount(bookingCode: string): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/bookings/${bookingCode}/cancel`]}>
        <Routes>
          <Route
            path="/bookings/:bookingCode/cancel"
            element={<CancellationPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function grant(): Promise<{
  bookingCode: string;
  ticketCodes: readonly string[];
}> {
  const issued = await issueTestTickets();
  const access = await httpTicketRepository.lookup({
    bookingCode: issued.bookingCode,
    verificationValue: "test+review@example.invalid",
  });
  ticketAccessStorage.write(access);
  return { bookingCode: issued.bookingCode, ticketCodes: access.ticketCodes };
}

describe("CancellationPage", () => {
  it("does not fetch or show booking data from booking code alone", async () => {
    const issued = await issueTestTickets();
    mount(issued.bookingCode);
    expect(await screen.findByText("Cần xác thực để hủy vé")).toBeVisible();
    expect(screen.queryByText("Khách Một")).toBeNull();
  });

  it("keeps submit disabled for none and confirms the exact selected ticket", async () => {
    const issued = await grant();
    mount(issued.bookingCode);
    const checks = await screen.findAllByRole("checkbox");
    expect(
      screen.getByRole("button", { name: "Xem phí và tiền hoàn" }),
    ).toBeDisabled();
    fireEvent.click(checks[0]);
    fireEvent.click(
      screen.getByRole("button", { name: "Xem phí và tiền hoàn" }),
    );
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      issued.ticketCodes[0],
    );
    expect(screen.getByRole("dialog")).not.toHaveTextContent(
      issued.ticketCodes[1],
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Vé được chọn để hủy");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Bến xe Miền Đông mới · Cổng 3 · Khu xe RedLine · Cột B12",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("288.000đ");
  });

  it("renders the exact structured selection hierarchy and truthful ten-percent fee", async () => {
    await grant();
    mount([...mockDb.tickets.values()][0].bookingCode);

    expect(await screen.findByText("Hành trình & nhà xe")).toBeVisible();
    expect(
      screen.getAllByText("Công ty TNHH RedLine Express").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Mã chuyến RLX-0730")).toBeVisible();
    expect(screen.getByText("6 giờ 30 · Đi thẳng")).toBeVisible();
    expect(screen.getByText("Mức 1 — Hủy trước 48 giờ")).toBeVisible();
    expect(screen.getByText("Giao dịch VNPay ban đầu")).toBeVisible();

    fireEvent.click((await screen.findAllByRole("checkbox"))[0]);
    expect(screen.getByText("Phí hủy 10%")).toBeVisible();
    expect(screen.getAllByText("32.000đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("288.000đ").length).toBeGreaterThan(0);
  });

  it("cancels both tickets once and renders processing refund", async () => {
    const issued = await grant();
    mount(issued.bookingCode);
    for (const checkbox of await screen.findAllByRole("checkbox"))
      fireEvent.click(checkbox);
    fireEvent.click(
      screen.getByRole("button", { name: "Xem phí và tiền hoàn" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Xác nhận hủy 2 vé" }),
    );
    expect(await screen.findByText("Theo dõi hoàn tiền")).toBeVisible();
    expect(screen.getByText("VNPay đang xử lý hoàn tiền")).toBeVisible();
    expect(screen.getByText("CHI TIẾT HOÀN TIỀN")).toBeVisible();
    expect(screen.getByText("TIẾN TRÌNH")).toBeVisible();
    expect(screen.getByText("₫576.000")).toBeVisible();
    expect(
      screen.getByText("Vé A01, A02 đã hủy; hoàn tiền được theo dõi độc lập."),
    ).toBeVisible();
    expect(mockDb.refunds).toHaveLength(1);
    expect(
      [...mockDb.tickets.values()].every(
        (ticket) => ticket.status === "cancelled",
      ),
    ).toBe(true);
  });

  it("restores the processing view after refresh instead of losing the refund", async () => {
    const issued = await grant();
    const { unmount } = (() => {
      mount(issued.bookingCode);
      return { unmount: cleanup };
    })();
    for (const checkbox of await screen.findAllByRole("checkbox"))
      fireEvent.click(checkbox);
    fireEvent.click(
      screen.getByRole("button", { name: "Xem phí và tiền hoàn" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Xác nhận hủy 2 vé" }),
    );
    await screen.findByText("Theo dõi hoàn tiền");
    unmount();

    mount(issued.bookingCode);
    expect(await screen.findByText("Theo dõi hoàn tiền")).toBeVisible();
    expect(screen.getByText("₫576.000")).toBeVisible();
  });

  it("reflects cancelled status after a refreshed guest detail request", async () => {
    const issued = await grant();
    const access = ticketAccessStorage.read();
    const ticket = [...mockDb.tickets.values()][0];
    mount(issued.bookingCode);
    fireEvent.click((await screen.findAllByRole("checkbox"))[0]);
    fireEvent.click(
      screen.getByRole("button", { name: "Xem phí và tiền hoàn" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Xác nhận hủy 1 vé" }),
    );
    await screen.findByText("Theo dõi hoàn tiền");
    const detail = await httpTicketRepository.getDetail(
      ticket.ticketCode,
      access?.token ?? "",
    );
    await waitFor(() => expect(detail.status).toBe("cancelled"));
  });
});
