import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Seat, type SeatStatus } from "@/shared/ui/Seat/Seat";

describe("Seat", () => {
  it("renders the exact Figma pillow primitive without a library icon", () => {
    const { container } = render(
      <Seat code="A01" onToggle={vi.fn()} status="available" />,
    );

    expect(container.querySelector(".seat__pillow")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("Seat when available calls onToggle with its code once", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<Seat code="A1" onToggle={onToggle} status="available" />);

    await user.click(screen.getByRole("button", { name: "Ghế A1" }));
    expect(onToggle).toHaveBeenCalledExactlyOnceWith("A1");
  });

  it("Seat when sold is disabled and blocks selection", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<Seat code="A2" onToggle={onToggle} status="sold" />);

    const seat = screen.getByRole("button", { name: "Ghế A2" });
    expect(seat).toBeDisabled();
    await user.click(seat);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it.each<{ status: SeatStatus; description: string }>([
    { status: "held", description: "Đang được giữ" },
    { status: "disabled", description: "Không khả dụng" },
  ])(
    "Seat when $status announces its state and blocks selection",
    async ({ status, description }) => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(<Seat code="B1" onToggle={onToggle} status={status} />);

      const seat = screen.getByRole("button", { name: "Ghế B1" });
      expect(seat).toBeDisabled();
      expect(seat).toHaveAttribute("aria-pressed", "false");
      expect(seat).toHaveAccessibleDescription(description);
      await user.click(seat);
      expect(onToggle).not.toHaveBeenCalled();
    },
  );

  it("Seat when selected announces its pressed state and supports keyboard toggle", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <Seat code="A1" isSelected onToggle={onToggle} status="available" />,
    );

    const seat = screen.getByRole("button", { name: "Ghế A1", pressed: true });
    expect(seat).toBeEnabled();
    expect(seat).toHaveAccessibleDescription("Đã chọn");
    await user.tab();
    expect(seat).toHaveFocus();
    await user.keyboard(" ");
    expect(onToggle).toHaveBeenCalledExactlyOnceWith("A1");
  });

  it("Seat reflects selection and availability updates from its caller", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <Seat code="A1" onToggle={onToggle} status="available" />,
    );

    const seat = screen.getByRole("button", { name: "Ghế A1", pressed: false });
    expect(seat).toHaveAccessibleDescription("Còn trống");
    rerender(
      <Seat code="A1" isSelected onToggle={onToggle} status="available" />,
    );
    expect(seat).toHaveAttribute("aria-pressed", "true");
    expect(seat).toHaveAccessibleDescription("Đã chọn");
    rerender(<Seat code="A1" onToggle={onToggle} status="sold" />);
    expect(seat).toBeDisabled();
    expect(seat).toHaveAttribute("aria-pressed", "false");
    expect(seat).toHaveAccessibleDescription("Đã bán");
  });

  it.each<{ status: SeatStatus; description: string }>([
    { status: "sold", description: "Đã bán" },
    { status: "held", description: "Đang được giữ" },
    { status: "disabled", description: "Không khả dụng" },
  ])(
    "Seat when $status ignores a stale selected flag",
    async ({ status, description }) => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(<Seat code="A1" isSelected onToggle={onToggle} status={status} />);

      const seat = screen.getByRole("button", { name: "Ghế A1" });
      expect(seat).toBeDisabled();
      expect(seat).toHaveAttribute("aria-pressed", "false");
      expect(seat).toHaveAccessibleDescription(description);
      expect(seat).not.toHaveClass("seat--selected");
      await user.click(seat);
      expect(onToggle).not.toHaveBeenCalled();
    },
  );
});
