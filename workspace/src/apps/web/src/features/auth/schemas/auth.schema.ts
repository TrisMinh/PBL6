import { z } from "zod";

import { contactDraftSchema } from "@/features/booking/schemas/passenger.schema";

const email = contactDraftSchema.shape.email.transform((value) =>
  value.toLowerCase(),
);
const password = z
  .string()
  .min(8, "Mật khẩu từ 8 ký tự.")
  .max(128, "Mật khẩu không quá 128 ký tự.");
const identifier = z
  .string()
  .trim()
  .min(1, "Nhập email hoặc số điện thoại.")
  .max(254, "Email hoặc số điện thoại quá dài.")
  .refine(
    (value) =>
      z.email().safeParse(value).success ||
      /^(?:0|\+84)[35789]\d{8}$/.test(value),
    "Nhập email hoặc số điện thoại Việt Nam hợp lệ.",
  )
  .transform((value) => value.toLowerCase());
export const loginSchema = z.object({ email: identifier, password }).strict();
export const registerSchema = loginSchema
  .extend({
    email,
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
