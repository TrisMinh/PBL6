import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { AccountChallengePage } from "./AccountChallengePage";

it("verifies the public demo code, rejects a wrong code, and does not call live services", async () => {
  const request = vi.spyOn(globalThis, "fetch");
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AccountChallengePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("heading", { name: "Xác minh email" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Mã xác minh"), {
    target: { value: "000000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận email" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Mã xác minh chưa đúng");
  fireEvent.change(screen.getByLabelText("Mã xác minh"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận email" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Email đã được xác minh",
  );
  expect(request).not.toHaveBeenCalled();
  request.mockRestore();
});

it("validates password confirmation before completing the demo reset", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AccountChallengePage reset />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("Mã xác minh"), {
    target: { value: "123456" },
  });
  fireEvent.change(screen.getByLabelText("Mật khẩu mới"), {
    target: { value: "NewDemo123" },
  });
  fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), {
    target: { value: "Different123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu mật khẩu mới" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Mật khẩu xác nhận chưa khớp",
  );
  fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), {
    target: { value: "NewDemo123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lưu mật khẩu mới" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Mật khẩu mô phỏng đã được cập nhật",
  );
});
