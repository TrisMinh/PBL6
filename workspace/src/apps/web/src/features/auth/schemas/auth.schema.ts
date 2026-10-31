import { z } from "zod";

import { contactDraftSchema } from "@/features/booking/schemas/passenger.schema";

const email = contactDraftSchema.shape.email.transform((value) =>
  value.toLowerCase(),
);
const password = z
  .string()
  .min(8, "Mật khẩu từ 8 ký tự.")
  .max(128, "Mật khẩu không quá 128 ký tự.");
export const loginSchema = z.object({ email, password }).strict();
export const registerSchema = loginSchema
  .extend({
    fullName: contactDraftSchema.shape.fullName,
    phone: contactDraftSchema.shape.phone,
    password: password
      .regex(/[A-Za-z]/, "Mật khẩu cần chữ và số.")
      .regex(/\d/, "Mật khẩu cần chữ và số."),
    confirmPassword: password,
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận chưa khớp.",
  });
export const forgotPasswordSchema = z.object({ email }).strict();
export const oauthSchema = z
  .object({
    provider: z.enum(["google", "facebook"]),
    scenario: z.enum(["success", "error"]).optional(),
  })
  .strict();
