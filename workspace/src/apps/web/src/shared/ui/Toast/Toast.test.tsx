import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("Toast", () => {
  it("dismisses at three seconds without restarting on parent renders", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const { rerender } = render(<Toast message="Đã lưu." onClose={done} />);
    act(() => vi.advanceTimersByTime(2000));
    rerender(<Toast message="Đã lưu." onClose={() => done()} />);
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByRole("status")).toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("allows manual dismissal and cancels its timeout", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    render(<Toast tone="error" message="Chưa thể tra cứu." onClose={done} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Chưa thể tra cứu.");
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("shows a new message with a fresh timer", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Toast message="Đã lưu hồ sơ." />);
    act(() => vi.advanceTimersByTime(3000));
    rerender(<Toast tone="error" message="Chưa lưu được ảnh." />);
    expect(screen.getByRole("alert")).toBeVisible();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
