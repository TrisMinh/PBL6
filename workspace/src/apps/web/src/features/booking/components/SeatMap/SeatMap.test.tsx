import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SeatMap } from "@/features/booking/components/SeatMap/SeatMap";
import type { SeatLayout } from "@/features/booking/types/seat";
import { createMockDb } from "@/mocks/state/mockDb";

function layout(tripId: string): SeatLayout {
  const db = createMockDb();
  const trip = db.trips.find((trip) => trip.id === tripId);
  if (!trip) throw new Error("Missing mock trip");
  return {
    tripId,
    vehicleType: trip.vehicleType,
    trip,
    items: db.seats.get(tripId) ?? [],
  };
}
describe("SeatMap", () => {
  it("uses the approved semantic contrast token for technical cabin labels", () => {
    const css = readFileSync(
      resolve("src/features/booking/components/SeatMap/SeatMap.css"),
      "utf8",
    );
    expect(css).toMatch(
      /\.seat-map__technical\s*\{[^}]*color:\s*var\(--color-text-secondary\)/s,
    );
  });
  it.each([
    ["trip-hcm-dalat-early", 22],
    ["trip-hcm-dalat-cabin", 34],
  ])("renders both decks and accessible legend for%s", (tripId, count) => {
    render(
      <SeatMap
        layout={layout(String(tripId))}
        selectedSeatIds={[]}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: /^Ghế / })).toHaveLength(
      Number(count),
    );
    expect(screen.getByRole("group", { name: "Tầng dưới · A" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Tầng trên · B" })).toBeVisible();
    for (const text of [
      "Chưa chọn",
      "Đang chọn",
      "Đang giữ",
      "Đã có người chọn",
    ])
      expect(
        within(
          screen.getByRole("list", { name: "Chú thích trạng thái ghế" }),
        ).getByText(text, { exact: true }),
      ).toBeVisible();
  });
  it("uses the exact Figma vehicle and sold-seat terminology for each layout", () => {
    const { rerender } = render(
      <SeatMap
        layout={layout("trip-hcm-dalat-cabin")}
        selectedSeatIds={[]}
        onToggle={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Limousine giường 34 chỗ" }),
    ).toBeVisible();
    expect(screen.getByText("Đã có người chọn", { exact: true })).toBeVisible();

    rerender(
      <SeatMap
        layout={layout("trip-hcm-dalat-early")}
        selectedSeatIds={[]}
        onToggle={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Limousine 22 cabin" }),
    ).toBeVisible();
    expect(screen.getByText("22 PHÒNG · 2 TẦNG")).toBeVisible();
  });
  it("passes stable IDs and keeps a selected own held seat available to deselect", async () => {
    const data = layout("trip-hcm-dalat-early");
    const onToggle = vi.fn();
    const own = data.items.find((seat) => seat.code === "A01");
    if (!own) throw new Error("Missing seat");
    own.status = "held";
    render(
      <SeatMap layout={data} selectedSeatIds={[own.id]} onToggle={onToggle} />,
    );
    const button = screen.getByRole("button", { name: "Ghế A01" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAccessibleDescription("Đã chọn");
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(own.id);
    expect(screen.getByRole("button", { name: "Ghế B07" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ghế A09" })).toBeDisabled();
  });
  it("blocks every native seat during pending without losing selected semantics", async () => {
    const data = layout("trip-hcm-dalat-early");
    const onToggle = vi.fn();
    render(
      <SeatMap
        layout={data}
        selectedSeatIds={[data.items[0]?.id ?? ""]}
        isPending
        onToggle={onToggle}
      />,
    );
    const selected = screen.getByRole("button", { name: "Ghế A01" });
    expect(selected).toBeDisabled();
    expect(selected).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(selected);
    expect(onToggle).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("group", { name: "Tầng trên · B" })).getByRole(
        "button",
        { name: "Ghế B01" },
      ),
    ).toBeDisabled();
  });
});
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
