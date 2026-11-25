import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { apiJson } from "@/shared/api/client";
import { BookingRefundLinks } from "./BookingRefundLinks";

vi.mock("@/shared/api/client", () => ({ apiJson: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const bookingId = "a0000000-0000-4000-8000-000000000001";
const common = {
  bookingId,
  paymentId: "a0000000-0000-4000-8000-000000000002",
  currency: "VND",
  reason: "CUSTOMER_CANCELLATION",
};
const completed = {
  ...common,
  id: "a0000000-0000-4000-8000-000000000003",
  refundReference: "REF-A14",
  amount: 207000,
  status: "SUCCEEDED",
  paymentProvider: "SIMULATOR",
};
const pending = {
  ...common,
  id: "a0000000-0000-4000-8000-000000000004",
  refundReference: "REF-A15",
  amount: 180000,
  status: "REQUESTED",
};

function mount(
  history = true,
  requestReference?: string,
  animateRequest = false,
  ticketRefundRequestId?: string,
): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BookingRefundLinks
          bookingId={bookingId}
          waiting={false}
          history={history}
          requestReference={requestReference}
          animateRequest={animateRequest}
          ticketRefundRequestId={ticketRefundRequestId}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it("keeps one detail card when switching between refunds of the same amount", async () => {
  const olderRequest = "a0000000-0000-4000-8000-000000000005";
  const newerRequest = "a0000000-0000-4000-8000-000000000006";
  const newerReference = `EVENT-${newerRequest.replaceAll("-", "")}`;
  vi.mocked(apiJson).mockImplementation(async (path) => {
    if (path.startsWith("/api/v1/refunds?"))
      return {
        items: [
          { ...pending, refundReference: newerReference },
          {
            ...completed,
            amount: pending.amount,
            refundRequestId: olderRequest,
          },
        ],
      };
    if (path === `/api/v1/bookings/${bookingId}/tickets`)
      return [
        { seatCode: "A14", refundRequestId: olderRequest },
        { seatCode: "A15", refundRequestId: newerRequest },
        { seatCode: "A16", refundRequestId: newerRequest },
        { seatCode: "A17", refundRequestId: null },
      ];
    return new Promise(() => {});
  });
  mount();

  const newest = await screen.findByRole("region", {
    name: `Khoản hoàn tiền ${newerReference}`,
  });
  expect(within(newest).getByText("180.000 ₫")).toBeVisible();
  expect(within(newest).getByRole("status")).toHaveTextContent(
    "Đã tiếp nhận yêu cầu hoàn tiền",
  );
  expect(
    screen.queryByRole("region", { name: /REF-A14/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Xem lịch sử hoàn tiền (1)"));
  expect(
    screen.getAllByRole("region", { name: /Khoản hoàn tiền/ }),
  ).toHaveLength(1);
  const history = screen.getByRole("list", { name: "Lịch sử hoàn tiền" });
  const olderEntry = within(history).getByRole("button", { name: /REF-A14/ });
  const newerEntry = within(history).getByRole("button", {
    name: new RegExp(newerReference),
  });
  expect(await within(olderEntry).findByText("Ghế A14")).toBeVisible();
  expect(within(newerEntry).getByText("Ghế A15, A16")).toBeVisible();
  expect(within(history).queryByText(/A17/)).not.toBeInTheDocument();
  fireEvent.click(olderEntry);
  const older = await screen.findByRole("region", { name: /REF-A14/ });
  expect(within(older).getByText("180.000 ₫")).toBeVisible();
  expect(
    screen.queryByRole("region", { name: `Khoản hoàn tiền ${newerReference}` }),
  ).not.toBeInTheDocument();
  expect(within(older).getByRole("status")).toHaveTextContent(
    "Đã hoàn trong mô phỏng",
  );
  expect(
    within(older).queryByText("Hoàn tiền thành công"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Theo dõi hoàn tiền" }),
  ).not.toBeInTheDocument();
  fireEvent.click(newerEntry);
  expect(
    screen.getByRole("region", { name: `Khoản hoàn tiền ${newerReference}` }),
  ).toBeVisible();
  expect(
    screen.getAllByRole("region", { name: /Khoản hoàn tiền/ }),
  ).toHaveLength(1);
});

it("keeps the refund link in ticket details", async () => {
  vi.mocked(apiJson).mockResolvedValue({ items: [completed] });
  mount(false);

  expect(
    await screen.findByRole("link", { name: "Theo dõi hoàn tiền" }),
  ).toHaveAttribute("href", `/refunds/${completed.id}`);
});

it("shows a status while an identified ticket refund has yet to arrive", async () => {
  vi.mocked(apiJson).mockResolvedValue({ items: [completed] });
  mount(false, undefined, false, "a0000000-0000-4000-8000-000000000007");
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Đang đối chiếu khoản hoàn của vé",
  );
  expect(
    screen.queryByRole("link", { name: "Theo dõi hoàn tiền" }),
  ).not.toBeInTheDocument();
});

it.each(["event reference", "audited request ID"])(
  "shows only the ticket refund using its %s",
  async (source) => {
    const request = "a0000000-0000-4000-8000-000000000007";
    const matched =
      source === "event reference"
        ? {
            ...completed,
            refundReference: `EVENT-${request.replaceAll("-", "")}`,
          }
        : { ...completed, refundRequestId: request };
    vi.mocked(apiJson).mockResolvedValue({
      items: [
        { ...pending, amount: completed.amount, status: "SUCCEEDED" },
        matched,
      ],
    });
    mount(false, undefined, false, request);
    const link = await screen.findByRole("link", {
      name: "Theo dõi hoàn tiền",
    });
    expect(link).toHaveAttribute("href", `/refunds/${completed.id}`);
    expect(screen.queryByText(/REF-A15/)).not.toBeInTheDocument();
  },
);

it("waits for the submitted refund and advances each step before showing its fast result", async () => {
  const result = {
    ...pending,
    status: "SUCCEEDED",
    paymentProvider: "SIMULATOR",
  };
  let reads = 0;
  vi.mocked(apiJson).mockImplementation(async (path) => {
    if (!path.startsWith("/api/v1/refunds?")) return new Promise(() => {});
    return { items: ++reads === 1 ? [completed] : [result, completed] };
  });
  mount(true, result.refundReference, true);

  expect(
    await screen.findByText(
      "Hồ sơ hoàn tiền đang được tạo. Trạng thái sẽ tự cập nhật.",
    ),
  ).toBeVisible();
  expect(
    screen.queryByRole("region", { name: /REF-A14/ }),
  ).not.toBeInTheDocument();
  const card = await screen.findByRole(
    "region",
    { name: /REF-A15/ },
    { timeout: 4000 },
  );
  expect(within(card).getByText("Vé đã hủy").closest("li")).toHaveAttribute(
    "aria-current",
    "step",
  );
  expect(within(card).getByRole("status")).toHaveTextContent(
    "Đã tiếp nhận yêu cầu hoàn tiền",
  );
  await within(card).findByText("Đang hiển thị kết quả");
  expect(
    within(card).getByText("Xử lý hoàn tiền").closest("li"),
  ).toHaveAttribute("aria-current", "step");
  await within(card).findByText("Đã hoàn trong mô phỏng", {
    selector: "li strong",
  });
  expect(within(card).getByRole("status")).toHaveTextContent(
    "Đã hoàn trong mô phỏng",
  );
});
