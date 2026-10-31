import { isMockApi } from "@/shared/api/config";
import { backendAuthRepository } from "./backendAuthRepository";
import { z } from "zod";

import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { requestBooking } from "@/features/booking/repositories/bookingHttp";
import type {
  AuthRepository,
  AuthSession,
} from "@/features/auth/repositories/authRepository";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  oauthSchema,
} from "@/features/auth/schemas/auth.schema";
import { authenticatedSessionSchema } from "@/features/auth/schemas/session.schema";
import { MOCK_SESSION_TTL_MS } from "@/features/auth/config/session";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new BookingRepositoryError("VALIDATION_ERROR", 400);
  return parsed.data;
}
async function authenticate(
  action: string,
  input: unknown,
  signal?: AbortSignal,
): Promise<AuthSession> {
  const session = await requestBooking(
    `/api/v1/auth/${action}`,
    authenticatedSessionSchema,
    { method: "POST", body: input, signal, expectedStatus: 200 },
  );
  const remaining = Date.parse(session.expiresAt) - Date.now();
  if (remaining <= 0 || remaining > MOCK_SESSION_TTL_MS)
    throw new BookingRepositoryError("INVALID_RESPONSE", 200);
  return session;
}
async function neutral(
  action: string,
  input: unknown,
  signal?: AbortSignal,
): Promise<void> {
  await requestBooking(
    `/api/v1/auth/${action}`,
    z.object({ accepted: z.literal(true) }).strict(),
    { method: "POST", body: input, signal, expectedStatus: 202 },
  );
}
const mockRepository: AuthRepository = {
  login: (input, signal) =>
    authenticate("login", parse(loginSchema, input), signal),
  oauth: (input, signal) =>
    authenticate("oauth", parse(oauthSchema, input), signal),
  register: (input, signal) =>
    neutral("register", parse(registerSchema, input), signal),
  forgot: (input, signal) =>
    neutral("forgot-password", parse(forgotPasswordSchema, input), signal),
};

export const httpAuthRepository = isMockApi
  ? mockRepository
  : backendAuthRepository;
