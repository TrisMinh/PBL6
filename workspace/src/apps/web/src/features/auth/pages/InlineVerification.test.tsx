import { beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
vi.mock("@/shared/api/config", () => ({ isMockApi: false, apiBaseUrl: "" }));
import { RegisterPage } from "./RegisterPage";
import { AccountChallengePage } from "./AccountChallengePage";
import {
  readPendingVerification,
  savePendingVerification,
} from "../lib/pendingVerification";
import { readApiSession } from "@/shared/api/session";

const firstId = "019a3a71-0000-7000-8000-000000000001";
const secondId = "019a3a71-0000-7000-8000-000000000002";
const session = {
  accessToken: "019a3a71-0000-7000-8000-000000000009",
  refreshToken: "test-refresh",
  tokenType: "Bearer",
  expiresIn: 900,
  sessionId: firstId,
  user: { id: secondId, roles: ["CUSTOMER"] },
};
beforeEach(() => sessionStorage.clear());
function Location(): ReactElement {
  return <p data-testid="location">{useLocation().pathname}</p>;
}
function mount(path = "/register"): ReturnType<typeof render> {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Location />
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<AccountChallengePage />} />
          <Route path="/account/tickets" element={<h1>Vé của tôi</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function input(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function fillRegistration(): void {
  input("Họ và tên", "Demo Customer");
  input("Số điện thoại", "0912345678");
  input("Email", "demo@example.test");
  input("Mật khẩu", "Password123");
  input("Xác nhận mật khẩu", "Password123");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
}
it("changes the registration form into code verification in place and signs in after real verification", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      Response.json(
        { operationId: firstId, status: "ACCEPTED" },
        { status: 202 },
      ),
    )
    .mockResolvedValueOnce(Response.json(session));
  mount();
  fillRegistration();
  await screen.findByRole("heading", { name: "Xác minh email" });
  expect(screen.getByTestId("location")).toHaveTextContent("/register");
  expect(screen.queryByLabelText("Mã yêu cầu")).not.toBeInTheDocument();
  expect(screen.getByText("demo@example.test")).toBeVisible();
  expect(readApiSession()).toBeNull();
  expect(JSON.stringify(readPendingVerification())).not.toContain(
    "Password123",
  );
  input("Mã xác minh", "123456");
  fireEvent.click(screen.getByRole("button", { name: "Xác minh và tiếp tục" }));
  await screen.findByRole("heading", { name: "Vé của tôi" });
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
    challengeId: firstId,
    code: "123456",
  });
  expect(readApiSession()?.accessToken).toBe(session.accessToken);
  expect(readPendingVerification()).toBeNull();
});
it("retains form values when editing registration information and clears the obsolete challenge", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    Response.json(
      { operationId: firstId, status: "ACCEPTED" },
      { status: 202 },
    ),
  );
  mount();
  fillRegistration();
  await screen.findByLabelText("Mã xác minh");
  fireEvent.click(
    screen.getByRole("button", { name: "Sửa thông tin đăng ký" }),
  );
  expect(screen.getByLabelText("Email")).toHaveValue("demo@example.test");
  expect(screen.getByLabelText("Họ và tên")).toHaveValue("Demo Customer");
  expect(readPendingVerification()).toBeNull();
  expect(screen.getByRole("button", { name: "Tạo tài khoản" })).toBeEnabled();
});
it("resumes after reload, replaces the internal challenge on resend, and explains invalid codes", async () => {
  savePendingVerification(firstId, "demo@example.test");
  const draft = readPendingVerification();
  if (!draft) throw new Error("Expected pending verification");
  sessionStorage.setItem(
    "blue-pending-verification",
    JSON.stringify({ ...draft, requestedAt: Date.now() - 61_000 }),
  );
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      Response.json(
        { operationId: secondId, status: "ACCEPTED" },
        { status: 202 },
      ),
    )
    .mockResolvedValueOnce(
      Response.json(
        {
          error: {
            code: "VERIFICATION_INVALID",
            message: "Internal challenge invalid",
          },
        },
        { status: 422 },
      ),
    );
  mount("/verify-email");
  await screen.findByLabelText("Mã xác minh");
  expect(screen.getByTestId("location")).toHaveTextContent("/register");
  fireEvent.click(screen.getByRole("button", { name: "Gửi lại mã" }));
  await screen.findByText("Đã gửi lại mã. Vui lòng dùng mã mới nhất.");
  expect(screen.getByRole("button", { name: /Gửi lại sau/ })).toBeDisabled();
  input("Mã xác minh", "000000");
  fireEvent.click(screen.getByRole("button", { name: "Xác minh và tiếp tục" }));
  await screen.findByText(/Mã xác minh không đúng hoặc đã được thay thế/);
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).challengeId).toBe(
    secondId,
  );
  expect(readApiSession()).toBeNull();
  await waitFor(() =>
    expect(screen.getByLabelText("Mã xác minh")).toBeEnabled(),
  );
});
