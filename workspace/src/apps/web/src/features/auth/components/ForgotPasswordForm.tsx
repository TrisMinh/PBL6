import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { ReactElement } from "react";
import { Link } from "react-router";

import { forgotPasswordSchema } from "@/features/auth/schemas/auth.schema";
import type { ForgotInput } from "@/features/auth/repositories/authRepository";
import { useAuthAction } from "@/features/auth/hooks/useAuthAction";
import {
  AuthError,
  NeutralSuccess,
} from "@/features/auth/components/AuthFeedback";
import { Input } from "@/shared/ui/Input/Input";
import { Button } from "@/shared/ui/Button/Button";
import { ROUTES } from "@/shared/config/routes";

export function ForgotPasswordForm(): ReactElement {
  const action = useAuthAction(),
    form = useForm<ForgotInput>({
      resolver: zodResolver(forgotPasswordSchema),
      defaultValues: { email: "" },
    });
  if (action.isSuccess) return <NeutralSuccess reset />;
  return (
    <>
      <AuthError error={action.error} />
      <form
        noValidate
        onSubmit={form.handleSubmit((input) =>
          action.submit({ kind: "forgot", input }),
        )}
      >
        <fieldset className="auth-page__fields" disabled={action.isPending}>
          <legend className="auth-page__sr-only">
            Khôi phục tài khoản mô phỏng
          </legend>
          <Input
            className="auth-page__control auth-page__control--identity"
            label="EMAIL HOẶC SỐ ĐIỆN THOẠI"
            placeholder="nhap@email.com"
            type="email"
            autoComplete="email"
            maxLength={254}
            error={form.formState.errors.email?.message}
            {...form.register("email")}
          />
          <Button type="submit" isLoading={action.isPending}>
            Gửi hướng dẫn
          </Button>
        </fieldset>
      </form>
      <ol className="auth-page__recovery-steps" aria-label="Các bước khôi phục">
        <li>
          <span>01</span>
          <strong>Gửi yêu cầu</strong>
        </li>
        <li>
          <span>02</span>
          <strong>Xác minh</strong>
        </li>
        <li>
          <span>03</span>
          <strong>Mật khẩu mới</strong>
        </li>
      </ol>
      <Link className="auth-page__back-login" to={ROUTES.login}>
        ← Quay lại đăng nhập
      </Link>
    </>
  );
}
