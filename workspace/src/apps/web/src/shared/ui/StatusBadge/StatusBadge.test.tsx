import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  StatusBadge,
  type StatusTone,
} from "@/shared/ui/StatusBadge/StatusBadge";

describe("StatusBadge", () => {
  it("StatusBadge without a tone renders readable neutral status content", () => {
    render(<StatusBadge>Đang xác nhận</StatusBadge>);

    expect(screen.getByText("Đang xác nhận")).toBeVisible();
    expect(screen.getByText("Đang xác nhận")).toHaveClass(
      "status-badge",
      "status-badge--neutral",
    );
  });

  it.each<{ tone: StatusTone; label: string }>([
    { tone: "success", label: "Đã thanh toán" },
    { tone: "warning", label: "Sắp hết hạn" },
    { tone: "error", label: "Thanh toán thất bại" },
  ])(
    "StatusBadge with $tone tone preserves its readable label",
    ({ tone, label }) => {
      render(<StatusBadge tone={tone}>{label}</StatusBadge>);

      expect(screen.getByText(label)).toBeVisible();
      expect(screen.getByText(label)).toHaveClass(
        "status-badge",
        `status-badge--${tone}`,
      );
    },
  );
});
