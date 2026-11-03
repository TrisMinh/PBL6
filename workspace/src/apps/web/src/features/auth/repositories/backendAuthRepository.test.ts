import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/shared/api/config", () => ({ isMockApi: false, apiBaseUrl: "" }));
import { backendAuthRepository } from "./backendAuthRepository";

beforeEach(() => {
  sessionStorage.clear();
});
it.each([401, 423, 429])(
  "uses login-specific messages for HTTP %s",
  async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: {
            code: status === 423 ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS",
            message: "Private backend message",
          },
        },
        { status },
      ),
    );
    try {
      await backendAuthRepository.login({
        email: "minh.anh@bluebus.test",
        password: "WrongPassword123",
      });
      throw new Error("Expected rejected login");
    } catch (error) {
      expect(error).toHaveProperty("status", status);
      const message = (error as Error).message;
      expect(message).not.toContain("Phiên đăng nhập đã hết hạn");
      expect(message).toContain(
        status === 401
          ? "Email/số điện thoại hoặc mật khẩu không đúng"
          : status === 423
            ? "Tài khoản đang bị khóa"
            : "quá nhiều lần",
      );
    }
  },
);
it("maps the login request and real JWT session to existing UI state", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      accessToken: "header.payload.signature",
      refreshToken: "refresh-secret",
      tokenType: "Bearer",
      expiresIn: 900,
      sessionId: "019a3a71-0000-7000-8000-000000000001",
      user: {
        id: "019a3a71-0000-7000-8000-000000000002",
        roles: ["PLATFORM_ADMIN"],
      },
    }),
  );
  const result = await backendAuthRepository.login({
    email: "admin@example.com",
    password: "Password123",
  });
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
    identifier: "admin@example.com",
    password: "Password123",
  });
  expect(result.role).toBe("admin");
  expect(result.token).toBe("header.payload.signature");
});
it("does not send an OAuth simulation request in live mode", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  await expect(
    backendAuthRepository.oauth({ provider: "google" }),
  ).rejects.toMatchObject({ status: 501 });
  expect(fetcher).not.toHaveBeenCalled();
});
