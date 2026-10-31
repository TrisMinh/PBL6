import type { z } from "zod";

import type {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
} from "@/features/auth/schemas/auth.schema";
import type { authenticatedSessionSchema } from "@/features/auth/schemas/session.schema";

export type AuthSession = z.infer<typeof authenticatedSessionSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotInput = z.infer<typeof forgotPasswordSchema>;
export type OAuthInput = {
  provider: "google" | "facebook";
  scenario?: "success" | "error";
};
export interface AuthRepository {
  login(input: LoginInput, signal?: AbortSignal): Promise<AuthSession>;
  oauth(input: OAuthInput, signal?: AbortSignal): Promise<AuthSession>;
  register(input: RegisterInput, signal?: AbortSignal): Promise<void>;
  forgot(input: ForgotInput, signal?: AbortSignal): Promise<void>;
}
