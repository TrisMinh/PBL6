import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import {
  figmaBookings,
  figmaPayments,
  figmaRefunds,
} from "@/mocks/fixtures/adminTransactions";
import {
  BookingFacts,
  PaymentFacts,
  RefundFacts,
} from "./components/TransactionFacts";
import { TransactionDetail } from "./pages/TransactionDetail";
import { TransactionList } from "./pages/TransactionList";
import {
  bookingLabel,
  paymentLabel,
  refundLabel,
  transactionMoney,
} from "./transactionProjection";
import type { ReactElement } from "react";

function LocationProbe(): ReactElement {
  const location = useLocation();
  return (
    <output aria-label="Current URL">
      {location.pathname}
      {location.search}
    </output>
  );
}
const loaded = {
  isPending: false,
  isError: false,
  error: null,
  refetch: () => undefined,
};

describe("canonical transaction audit presentation", () => {
  for (const booking of figmaBookings) {
    it(`shows ${booking.id} lifecycle and truthful related records`, () => {
      render(
        <MemoryRouter>
          <TransactionDetail
            resource="bookings"
            result={{ ...loaded, data: booking }}
          >
            <BookingFacts booking={booking} />
          </TransactionDetail>
        </MemoryRouter>,
      );

      expect(
        screen.getAllByText(bookingLabel(booking), { exact: true }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByRole("link", { name: booking.audit.paymentId }),
      ).toHaveAttribute("href", `/admin/payments/${booking.audit.paymentId}`);
      expect(
        screen.getAllByText(transactionMoney(booking.totalVnd), { exact: true })
          .length,
      ).toBeGreaterThan(0);
    });
  }
  for (const payment of figmaPayments) {
    it(`shows ${payment.id} collection outcome independently of refunds`, () => {
      render(
        <MemoryRouter>
          <TransactionDetail
            resource="payments"
            result={{ ...loaded, data: payment }}
          >
            <PaymentFacts payment={payment} />
          </TransactionDetail>
        </MemoryRouter>,
      );
      expect(
        screen.getAllByText(paymentLabel(payment), { exact: true }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByRole("link", { name: payment.bookingId }),
      ).toHaveAttribute("href", `/admin/bookings/${payment.bookingId}`);
      expect(
        screen.getByText(payment.audit.correlationId, { exact: true }),
      ).toBeInTheDocument();
    });
  }
  for (const refund of figmaRefunds) {
    it(`shows ${refund.id} transfer outcome and source payment`, () => {
      render(
        <MemoryRouter>
          <TransactionDetail
            resource="refunds"
            result={{ ...loaded, data: refund }}
          >
            <RefundFacts refund={refund} />
          </TransactionDetail>
        </MemoryRouter>,
      );
      expect(
        screen.getByText(refundLabel(refund), { exact: true }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: refund.paymentId }),
      ).toHaveAttribute("href", `/admin/payments/${refund.paymentId}`);
      expect(
        screen.getByText(refund.audit.correlationId, { exact: true }),
      ).toBeInTheDocument();
    });
  }
  for (const resource of ["bookings", "payments", "refunds"] as const) {
    it(`${resource} dialog selection owns URL and clear retains unrelated parameters`, async () => {
      const user = userEvent.setup();
      const items =
        resource === "bookings"
          ? figmaBookings
          : resource === "payments"
            ? figmaPayments
            : figmaRefunds;
      render(
        <MemoryRouter initialEntries={[`/admin/${resource}?future=keep`]}>
          <TransactionList
            resource={resource}
            result={{
              ...loaded,
              data: { items, total: items.length, page: 1, pageSize: 20 },
            }}
          />
          <LocationProbe />
        </MemoryRouter>,
      );
      await user.click(screen.getByRole("button", { name: /^Mã tra cứu/ }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name:
            resource === "bookings"
              ? "BK-260916-018"
              : resource === "payments"
                ? "PAY-260916-018"
                : "RF-260916-018",
        }),
      );
      expect(screen.getByLabelText("Current URL")).toHaveTextContent(
        "future=keep&query=",
      );
      await user.click(screen.getByRole("button", { name: /^Nhà xe/ }));
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "BlueLine Co.",
        }),
      );
      expect(screen.getByLabelText("Current URL")).toHaveTextContent(
        "organizationId=ORG-001",
      );
      await user.click(screen.getByRole("button", { name: /^Trạng thái/ }));
      const label =
        resource === "bookings"
          ? "Chờ hoàn tiền"
          : resource === "payments"
            ? "Chờ hoàn tiền"
            : "Đang xử lý";
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: label,
        }),
      );
      expect(screen.getByLabelText("Current URL")).toHaveTextContent(
        "viewStatus=",
      );
      await user.click(
        screen.getByRole("button", { name: "Xóa bộ lọc" }),
      );
      expect(screen.getByLabelText("Current URL")).toHaveTextContent(
        `/admin/${resource}?future=keep`,
      );
    });
  }
});
