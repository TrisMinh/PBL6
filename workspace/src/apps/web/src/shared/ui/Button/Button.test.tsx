import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/shared/ui/Button/Button";

describe("Button", () => {
  it("Button while loading announces busy state and blocks repeated activation", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Thanh toán
      </Button>,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName("Đang xử lý");

    await user.click(button);
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("Button when disabled blocks activation without announcing loading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick} variant="danger">
        Hủy vé
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Hủy vé" });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("Button when enabled forwards native props and supports keyboard activation", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button
        aria-label="Tìm chuyến phù hợp"
        onClick={onClick}
        type="button"
        variant="secondary"
      >
        Tìm chuyến
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Tìm chuyến phù hợp" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("aria-busy");

    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("Button after loading restores its action label and click handler", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <Button aria-busy={false} isLoading onClick={onClick} variant="ghost">
        Tiếp tục
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Đang xử lý" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    rerender(
      <Button isLoading={false} onClick={onClick} variant="ghost">
        Tiếp tục
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Tiếp tục" });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
