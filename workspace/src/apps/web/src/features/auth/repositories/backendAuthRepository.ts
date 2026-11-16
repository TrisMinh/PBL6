import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { ApiError, unavailable } from "@/shared/api/error";
import {
  backendSessionSchema,
  saveApiSession,
  toUiSession,
} from "@/shared/api/session";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import type { AuthRepository } from "./authRepository";
import {
  clearPendingVerification,
  savePendingVerification,
} from "../lib/pendingVerification";

const accepted = z.object({
  operationId: z.string().uuid(),
  status: z.string(),
});
async function authAction<T>(
  action: () => Promise<T>,
  login = false,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError) {
      const mapped = new BookingRepositoryError(
        error.status === 401
          ? "INVALID_CREDENTIALS"
          : error.code === "ABORTED"
            ? "ABORTED"
            : error.status === 400
              ? "VALIDATION_ERROR"
              : "HTTP_ERROR",
        error.status,
      );
      mapped.message =
        login && error.status === 401
          ? "Email/số điện thoại hoặc mật khẩu không đúng. Vui lòng kiểm tra và thử lại."
          : login && error.status === 423
            ? "Tài khoản đang bị khóa. Vui lòng thử lại sau hoặc liên hệ hỗ trợ."
            : login && error.status === 429
              ? "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ rồi thử lại."
              : error.code === "VERIFICATION_EXPIRED"
                ? "Mã xác minh đã hết hạn. Vui lòng gửi lại mã mới."
                : error.code === "VERIFICATION_INVALID"
                  ? "Mã xác minh không đúng hoặc đã được thay thế. Vui lòng kiểm tra mã mới nhất."
                  : error.code === "IDENTITY_ALREADY_USED"
                    ? "Email hoặc số điện thoại này đang được sử dụng bởi tài khoản khác. Vui lòng đăng nhập hoặc khôi phục mật khẩu."
                    : error.message;
      throw mapped;
    }
    throw error;
  }
}
export const backendAuthRepository: AuthRepository = {
  login: (input, signal) =>
    authAction(async () => {
      const session = await apiJson(
        "/api/v1/auth/login",
        backendSessionSchema,
        {
          method: "POST",
          auth: false,
          body: { identifier: input.email, password: input.password },
          signal,
        },
      );
      if (signal?.aborted)
        throw new ApiError("ABORTED", 0, "Yêu cầu đã được hủy.");
      return toUiSession(saveApiSession(session));
    }, true),
  register: (input, signal) =>
    authAction(async () => {
      const result = await apiJson("/api/v1/auth/register", accepted, {
        method: "POST",
        auth: false,
        signal,
        body: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          password: input.password,
        },
      });
      savePendingVerification(result.operationId, input.email);
    }),
  forgot: (input, signal) =>
    authAction(async () => {
      await apiJson("/api/v1/auth/forgot-password", accepted, {
        method: "POST",
        auth: false,
        body: input,
        signal,
        idempotencyKey: crypto.randomUUID(),
      });
    }),
  oauth: () => authAction(async () => unavailable("Đăng nhập Google/Facebook")),
};

export async function verifyEmail(
  challengeId: string,
  code: string,
): Promise<ReturnType<typeof toUiSession>> {
  return authAction(async () => {
    const session = await apiJson("/api/v1/auth/verify", backendSessionSchema, {
      method: "POST",
      auth: false,
      body: { challengeId, code },
      idempotencyKey: crypto.randomUUID(),
    });
    clearPendingVerification();
    return toUiSession(saveApiSession(session));
  });
}
export async function resendVerification(email: string): Promise<void> {
  return authAction(async () => {
    const result = await apiJson("/api/v1/auth/resend-verification", accepted, {
      method: "POST",
      auth: false,
      body: { email },
      idempotencyKey: crypto.randomUUID(),
    });
    savePendingVerification(result.operationId, email);
  });
}
export async function resetPassword(
  challengeId: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await apiJson("/api/v1/auth/reset-password", z.unknown(), {
    method: "POST",
    auth: false,
    body: { challengeId, code, newPassword },
    idempotencyKey: crypto.randomUUID(),
  });
}
