import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminRepository } from "@/features/admin/repositories/adminRepository";
import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import { BookingDetailPage } from "@/features/admin/transactions/pages/BookingDetailPage";
import { BookingListPage } from "@/features/admin/transactions/pages/BookingListPage";
import { PaymentDetailPage } from "@/features/admin/transactions/pages/PaymentDetailPage";
import { PaymentListPage } from "@/features/admin/transactions/pages/PaymentListPage";
import { RefundDetailPage } from "@/features/admin/transactions/pages/RefundDetailPage";
import { RefundListPage } from "@/features/admin/transactions/pages/RefundListPage";

const repository = vi.hoisted(() => ({
  listBookings: vi.fn(),
  getBooking: vi.fn(),
  listPayments: vi.fn(),
  getPayment: vi.fn(),
  listRefunds: vi.fn(),
  getRefund: vi.fn(),
}));

vi.mock("@/features/auth/hooks/useMockSession", () => ({
  useMockSession: () => ({ session: { role: "admin", token: "admin-token" } }),
}));
vi.mock("@/features/admin/repositories/httpAdminRepository", () => ({
  createHttpAdminRepository: () => repository as unknown as AdminRepository,
}));

const booking = {
  id: "booking-1",
  bookingCode: "BK-DEMO-001",
  organizationId: "org-1",
  customerName: "Khách mô phỏng",
  routeLabel: "Đà Nẵng — Huế",
  passengerCount: 2,
  totalVnd: 360000,
  status: "paid",
  createdAt: "2026-10-01T02:00:00.000Z",
  updatedAt: "2026-10-01T03:00:00.000Z",
} as const;
const payment = {
  id: "payment-1",
  bookingId: "booking-1",
  transactionCode: "VNP-DEMO-001",
  amountVnd: 360000,
  status: "success",
  createdAt: "2026-10-01T02:10:00.000Z",
  updatedAt: "2026-10-01T02:11:00.000Z",
} as const;
const refund = {
  id: "refund-1",
  bookingId: "booking-1",
  paymentId: "payment-1",
  amountVnd: 180000,
  status: "processing",
  createdAt: "2026-10-02T02:00:00.000Z",
  updatedAt: "2026-10-02T02:00:00.000Z",
} as const;

function LocationProbe(): ReactElement {
  const location = useLocation();
  return (
    <output aria-label="Current URL">{`${location.pathname}${location.search}`}</output>
  );
}
function renderPage(page: ReactElement, entry = "/admin/bookings"): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        {page}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("admin transaction pages", () => {
  beforeEach(() => {
    for (const mock of Object.values(repository)) mock.mockReset();
    repository.listBookings.mockResolvedValue({
      items: [booking],
      page: 1,
      pageSize: 20,
      total: 40,
    });
    repository.getBooking.mockResolvedValue(booking);
    repository.listPayments.mockResolvedValue({
      items: [payment],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    repository.getPayment.mockResolvedValue(payment);
    repository.listRefunds.mockResolvedValue({
      items: [refund],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    repository.getRefund.mockResolvedValue(refund);
  });

  it.each([
    [<BookingListPage />, "booking-1", "/admin/bookings/booking-1"],
    [<PaymentListPage />, "payment-1", "/admin/payments/payment-1"],
    [<RefundListPage />, "refund-1", "/admin/refunds/refund-1"],
  ])("renders list data and detail links", async (page, text, href) => {
    renderPage(page);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text })).toHaveAttribute(
      "href",
      href,
    );
  });

  it.each([
    [<BookingDetailPage bookingId="booking-1" />, "BK-DEMO-001"],
    [<PaymentDetailPage paymentId="payment-1" />, "payment-1"],
    [<RefundDetailPage refundId="refund-1" />, "refund-1"],
  ])("renders detail relationships", async (page, heading) => {
    renderPage(page);
    expect(
      await screen.findByText(heading, { exact: true }),
    ).toBeInTheDocument();
  });

  it("updates canonical pagination URL while retaining filters", async () => {
    const user = userEvent.setup();
    renderPage(<BookingListPage />, "/admin/bookings?query=demo&status=paid");
    await screen.findByText("booking-1");
    await user.click(screen.getByRole("button", { name: "Trang tiếp theo" }));
    expect(screen.getByLabelText("Current URL")).toHaveTextContent(
      "query=demo&status=paid&page=2",
    );
  });

  it("renders empty, retryable error, forbidden and not-found as distinct states", async () => {
    repository.listBookings.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    renderPage(<BookingListPage />);
    expect(
      await screen.findByRole("heading", {
        name: "Không tìm thấy kết quả",
      }),
    ).toBeInTheDocument();
  });

  it("announces list loading without exposing stale rows", () => {
    repository.listRefunds.mockReturnValue(new Promise(() => undefined));
    renderPage(<RefundListPage />);
    expect(
      screen.getByRole("status", { name: "Đang tải dữ liệu" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("refund-1")).not.toBeInTheDocument();
  });

  it.each([
    [
      new AdminRepositoryError("HTTP_ERROR", 503),
      "Chưa tải được dữ liệu",
      true,
    ],
    [
      new AdminRepositoryError("HTTP_ERROR", 403),
      "Bạn chưa có quyền truy cập",
      false,
    ],
  ])("maps list failure families", async (error, title, retry) => {
    repository.listPayments.mockRejectedValue(error);
    renderPage(<PaymentListPage />);
    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBe(
      retry ? screen.getByRole("button", { name: "Thử lại" }) : null,
    );
  });

  it.each([
    [new AdminRepositoryError("HTTP_ERROR", 404), "Không tìm thấy hồ sơ"],
    [new AdminRepositoryError("HTTP_ERROR", 403), "Bạn chưa có quyền truy cập"],
  ])("maps non-retryable detail state", async (error, title) => {
    repository.getRefund.mockRejectedValue(error);
    renderPage(<RefundDetailPage refundId="missing" />);
    expect(
      await screen.findByRole("heading", { name: title }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Thử lại" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("offers retry for a retryable detail failure", async () => {
    repository.getPayment.mockRejectedValue(
      new AdminRepositoryError("NETWORK_ERROR"),
    );
    renderPage(<PaymentDetailPage paymentId="payment-1" />);
    expect(
      await screen.findByRole("heading", { name: "Chưa tải được dữ liệu" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeEnabled();
  });
});
