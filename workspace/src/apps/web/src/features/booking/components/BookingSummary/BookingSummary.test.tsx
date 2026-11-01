import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BookingSummary } from "@/features/booking/components/BookingSummary/BookingSummary";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import { createMockDb } from "@/mocks/state/mockDb";

const db = createMockDb();
const trip = db.trips[0];
const layout: SeatLayout = {
  tripId: trip.id,
  vehicleType: trip.vehicleType,
  trip,
  items: db.seats.get(trip.id) ?? [],
};
const draft: BookingDraft = {
  sessionId: "session",
  tripId: trip.id,
  passengerCount: 2,
  selectedSeatIds: [`${trip.id}:A01`, `${trip.id}:A02`],
  passengers: [],
  totalVnd: 640_000,
  expiresAt: "2099-01-01T00:00:00Z",
};
describe("BookingSummary", () => {
  it("shows trusted journey/selected codes/price/total/timer without invented fees and continues exact count", async () => {
    const onContinue = vi.fn();
    render(
      <BookingSummary
        draft={draft}
        layout={layout}
        countdown={{ remainingSeconds: 599, isExpired: false }}
        onContinue={onContinue}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Chuyến đi của bạn" }),
    ).toBeVisible();
    expect(screen.getByRole("timer")).toHaveTextContent("09:59");
    expect(screen.getByText("A01, A02")).toBeVisible();
    expect(screen.getAllByText("640.000 ₫")).toHaveLength(2);
    expect(screen.queryByText("Phí dịch vụ")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Tiếp tục" });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onContinue).toHaveBeenCalledOnce();
  });
  it("renders the exact passenger and review summary structures without changing canonical totals", () => {
    const { rerender } = render(
      <BookingSummary
        draft={draft}
        layout={layout}
        countdown={{ remainingSeconds: 438, isExpired: false }}
        variant="passenger"
      />,
    );
    expect(screen.getByText("ĐƠN VỊ VẬN HÀNH")).toBeVisible();
    expect(screen.getByText("2 người")).toBeVisible();
    expect(screen.getByText("Phí dịch vụ")).toBeVisible();
    expect(screen.getByText("0 ₫")).toBeVisible();
    rerender(
      <BookingSummary
        draft={draft}
        layout={layout}
        countdown={{ remainingSeconds: 333, isExpired: false }}
        variant="review"
        actionLabel="Tiếp tục thanh toán"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Tóm tắt thanh toán" }),
    ).toBeVisible();
    expect(screen.getByText("PHƯƠNG THỨC THANH TOÁN")).toBeVisible();
    expect(screen.getByText("Chọn ở bước tiếp theo")).toBeVisible();
    expect(screen.getByText("Khuyến mãi")).toBeVisible();
  });
  it.each([0, 1, 3, 6])(
    "blocks count%i unless exactly persisted passengerCount",
    (count) => {
      const seatIds = layout.items
        .filter((seat) => seat.status === "available")
        .slice(0, count)
        .map((seat) => seat.id);
      render(
        <BookingSummary
          draft={{
            ...draft,
            selectedSeatIds: seatIds,
            totalVnd: trip.fareVnd * count,
          }}
          layout={layout}
          countdown={{ remainingSeconds: 500, isExpired: false }}
          onContinue={vi.fn()}
        />,
      );
      expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
    },
  );
  it.each([
    { isPending: true, remainingSeconds: 500, isExpired: false },
    { isPending: false, remainingSeconds: 0, isExpired: true },
    { isPending: false, remainingSeconds: 0, isExpired: false },
  ])("blocks pending/expired/unevaluated timer%j", (state) => {
    render(
      <BookingSummary
        draft={draft}
        layout={layout}
        countdown={state}
        isPending={state.isPending}
        onContinue={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Tiếp tục|Đang xử lý/ }),
    ).toBeDisabled();
  });
});
it.each(["duplicate", "stale total"])(
  "blocks a hydrated %s draft even when raw array length equals passenger count",
  (mode) => {
    const invalid =
      mode === "duplicate"
        ? { ...draft, selectedSeatIds: [`${trip.id}:A01`, `${trip.id}:A01`] }
        : { ...draft, totalVnd: 1 };
    render(
      <BookingSummary
        draft={invalid}
        layout={layout}
        countdown={{ remainingSeconds: 500, isExpired: false }}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
  },
);
