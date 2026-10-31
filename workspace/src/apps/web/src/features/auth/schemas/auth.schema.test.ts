import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
} from "@/features/auth/schemas/auth.schema";

const login = {
  email: " TEST+review@EXAMPLE.invalid ",
  password: "BlueDemo2026",
};
const registration = {
  ...login,
  fullName: " Demo User ",
  phone: "0901234567",
  confirmPassword: login.password,
};
describe("auth validation", () => {
  it("canonicalizes email while preserving password bytes", () => {
    expect(loginSchema.parse({ ...login, password: " BlueDemo2026 " })).toEqual(
      { email: "test+review@example.invalid", password: " BlueDemo2026 " },
    );
  });
  it.each(["", "bad", "a".repeat(255)])("rejects invalid email", (email) => {
    expect(loginSchema.safeParse({ ...login, email }).success).toBe(false);
  });
  it.each(["", "short", "a".repeat(129)])(
    "rejects invalid passwords",
    (password) => {
      expect(loginSchema.safeParse({ ...login, password }).success).toBe(false);
    },
  );
  it("parses registration with canonical contact fields", () => {
    expect(registerSchema.parse(registration)).toEqual({
      ...registration,
      fullName: "Demo User",
      email: "test+review@example.invalid",
    });
  });
  it.each([
    { confirmPassword: "Different2026" },
    { password: "abcdefgh", confirmPassword: "abcdefgh" },
    { phone: "123" },
    { fullName: " " },
  ])("rejects invalid registration", (patch) => {
    expect(
      registerSchema.safeParse({ ...registration, ...patch }).success,
    ).toBe(false);
  });
  it("forgot has only email and no credentials", () => {
    expect(forgotPasswordSchema.parse({ email: login.email })).toEqual({
      email: "test+review@example.invalid",
    });
    expect(
      forgotPasswordSchema.safeParse({
        email: login.email,
        password: login.password,
      }).success,
    ).toBe(false);
  });
});
