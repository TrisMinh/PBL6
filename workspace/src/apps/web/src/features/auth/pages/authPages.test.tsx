import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { MOCK_SESSION_STORAGE_KEY } from "@/features/auth/config/session";
import { server } from "@/mocks/server";
import { mockDb } from "@/mocks/state/mockDb";

beforeEach(() => {
  mockDb.reset();
  sessionStorage.clear();
});
afterEach(cleanup);
function Destination(): ReactElement {
  const location = useLocation();
  return <p>Destination {location.pathname}</p>;
}
function mount(path = "/login", from?: string): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: path, state: { from } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="*" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
function fill(
  email = "test+review@example.invalid",
  password = "BlueDemo2026",
): void {
  fireEvent.change(screen.getByLabelText(/Email/), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), {
    target: { value: password },
  });
}
describe("auth forms through real HTTP", () => {
  it.each([
    ["/login", "TÀI KHOẢN KHÁCH HÀNG", "Đăng nhập để tiếp tục"],
    [
      "/register",
      "BẮT ĐẦU HÀNH TRÌNH",
      "Chỉ mất một phút. Bạn sẽ xác minh ở bước tiếp theo.",
    ],
    [
      "/forgot-password",
      "KHÔI PHỤC TÀI KHOẢN",
      "Nhập email hoặc số điện thoại đã đăng ký. BLUE sẽ gửi mã hoặc liên kết đặt lại.",
    ],
  ])(
    "renders the exact Figma content contract for %s",
    (path, eyebrow, copy) => {
      mount(path);

      expect(screen.getByRole("img", { name: "BLUE" })).toBeVisible();
      expect(screen.getByText(eyebrow, { exact: true })).toBeVisible();
      expect(screen.getByText(copy, { exact: true })).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Về trang chủ" }),
      ).toHaveAttribute("href", "/");
    },
  );

  it("keeps the exact forgot-password recovery steps", () => {
    mount("/forgot-password");

    expect(screen.getByText("Gửi yêu cầu", { exact: true })).toBeVisible();
    expect(screen.getByText("Xác minh", { exact: true })).toBeVisible();
    expect(screen.getByText("Mật khẩu mới", { exact: true })).toBeVisible();
  });
  it("validates empty login fields and focuses email", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    await waitFor(() => expect(screen.getByLabelText(/Email/)).toHaveFocus());
  });
  it.each([
    ["test+review@example.invalid", "/account/tickets"],
    ["admin@blue.example.invalid", "/admin/organizations"],
  ])(
    "login routes %s safely and caches no credentials",
    async (email, path) => {
      const client = mount();
      fill(email);
      fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
      expect(await screen.findByText(`Destination ${path}`)).toBeVisible();
      expect(
        JSON.parse(sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY) ?? "null"),
      ).toMatchObject({ token: expect.any(String) });
      expect(
        JSON.stringify(
          [...client.getMutationCache().getAll()].map((m) => m.state.variables),
        ),
      ).not.toMatch(/BlueDemo|password|email/);
      expect(sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).not.toMatch(
        /password|email|BlueDemo/,
      );
    },
  );
  it("preserves intended admin path without open redirect", async () => {
    mount("/login", "/admin/bookings/booking-1");
    fill("admin@blue.example.invalid");
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(
      await screen.findByText("Destination /admin/bookings/booking-1"),
    ).toBeVisible();
  });
  it("invalid credentials offer accessible retry without navigation", async () => {
    mount();
    fill(undefined, "WrongPass2026");
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email hoặc mật khẩu mô phỏng chưa đúng",
    );
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(
      await screen.findByText("Destination /account/tickets"),
    ).toBeVisible();
  });
  it("rapid submit sends one request and unmount suppresses stale session", async () => {
    let calls = 0;
    server.use(
      http.post("/api/v1/auth/login", async () => {
        calls++;
        await delay(60);
        return HttpResponse.json({
          userId: "mock-customer",
          role: "customer",
          token: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        });
      }),
    );
    mount();
    fill();
    const button = screen.getByRole("button", { name: "Đăng nhập" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(calls).toBe(1));
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBeNull();
  });
  it("provider error is explicit and retry succeeds", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Kịch bản đăng nhập mô phỏng"), {
      target: { value: "error" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Google (mô phỏng)" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Kịch bản đăng nhập mô phỏng"), {
      target: { value: "success" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Facebook (mô phỏng)" }),
    );
    expect(
      await screen.findByText("Destination /account/tickets"),
    ).toBeVisible();
  });
  it("register validates confirmation and responds neutrally without account creation", async () => {
    mount("/register");
    fill();
    fireEvent.change(screen.getByLabelText("Họ và tên"), {
      target: { value: "Demo User" },
    });
    fireEvent.change(screen.getByLabelText("Số điện thoại"), {
      target: { value: "0901234567" },
    });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu"), {
      target: { value: "Different2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("chưa khớp");
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu"), {
      target: { value: "BlueDemo2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Yêu cầu mô phỏng đã được tiếp nhận",
    );
    expect(sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY)).toBeNull();
  });
  it("forgot is neutral and makes no real email claim", async () => {
    mount("/forgot-password");
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "unknown@example.invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi hướng dẫn" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Yêu cầu mô phỏng đã được tiếp nhận",
    );
    expect(screen.getByText(/Không gửi email/)).toBeVisible();
  });
});
