import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/shared/api/config", () => ({ isMockApi: false, apiBaseUrl: "" }));
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CouponReview } from "./CouponReview";
import { keyFor } from "../repositories/backendBookingRepository";
import type { BookingDraft } from "../types/booking";
const draft: BookingDraft = {
  sessionId: "coupon-session",
  tripId: "coupon-trip",
  passengerCount: 1,
  selectedSeatIds: ["seat"],
  passengers: [],
  totalVnd: 300000,
  expiresAt: "2099-01-01T00:00:00Z",
};
const quote = {
  code: "BLUE20",
  subtotal: 300000,
  discount: 50000,
  total: 250000,
  currency: "VND",
  expiresAt: "2099-01-01T00:00:00Z",
};
beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem(
    keyFor(draft.sessionId),
    JSON.stringify({ holdToken: "owned-hold" }),
  );
});
function mount(locked = false): {
  onChange: ReturnType<typeof vi.fn>;
  onPending: ReturnType<typeof vi.fn>;
} {
  const onChange = vi.fn();
  const onPending = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <CouponReview
        draft={draft}
        locked={locked}
        onChange={onChange}
        onPending={onPending}
      />
    </QueryClientProvider>,
  );
  return { onChange, onPending };
}
it("uses only the server quote and sends code plus held-seat proof", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(quote));
  const { onChange, onPending } = mount();
  await userEvent.type(screen.getByLabelText("Mã giảm giá"), "blue20");
  await userEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(quote));
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
    holdToken: "owned-hold",
    code: "BLUE20",
  });
  expect(onPending).toHaveBeenCalledWith(true);
  expect(onPending).toHaveBeenLastCalledWith(false);
});
it("rejects invalid or expired coupons without changing the price", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "internal-provider-secret",
        },
      },
      { status: 400 },
    ),
  );
  const { onChange } = mount();
  await userEvent.type(screen.getByLabelText("Mã giảm giá"), "EXPIRED");
  await userEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Mã giảm giá không hợp lệ",
  );
  expect(screen.getByLabelText("Mã giảm giá")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(
    screen.queryByText(/internal-provider-secret/),
  ).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});
it("blocks coupon edits while a booking request is unresolved", () => {
  mount(true);
  expect(screen.getByLabelText("Mã giảm giá")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Áp dụng" })).toBeDisabled();
});
