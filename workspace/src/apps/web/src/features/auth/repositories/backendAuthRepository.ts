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

const accepted = z.object({
  operationId: z.string().uuid(),
  status: z.string(),
});
async function authAction<T>(action: () => Promise<T>): Promise<T> {
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
      mapped.message = error.message;
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
    }),
  register: (input, signal) =>
    authAction(async () => {
      await apiJson("/api/v1/auth/register", accepted, {
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
): Promise<void> {
  await apiJson("/api/v1/auth/verify", z.unknown(), {
    method: "POST",
    auth: false,
    body: { challengeId, code },
    idempotencyKey: crypto.randomUUID(),
  });
}
export async function resendVerification(email: string): Promise<void> {
  await apiJson("/api/v1/auth/resend-verification", accepted, {
    method: "POST",
    auth: false,
    body: { email },
    idempotencyKey: crypto.randomUUID(),
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
