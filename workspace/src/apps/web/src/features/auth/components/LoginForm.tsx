import { Toast } from "@/shared/ui/Toast/Toast";
import { isMockApi } from "@/shared/api/config";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useState, type ReactElement } from "react";
import { Link } from "react-router";

import google from "@/assets/auth/google.svg";
import facebook from "@/assets/auth/facebook.svg";
import { loginSchema } from "@/features/auth/schemas/auth.schema";
import type { LoginInput } from "@/features/auth/repositories/authRepository";
import { useAuthAction } from "@/features/auth/hooks/useAuthAction";
import { AuthError } from "@/features/auth/components/AuthFeedback";
import { ROUTES } from "@/shared/config/routes";
import { Input } from "@/shared/ui/Input/Input";
import { Button } from "@/shared/ui/Button/Button";

const PROVIDERS: readonly ("google" | "facebook")[] = ["facebook", "google"];
function ProviderButton({
  provider,
  action,
}: {
  provider: "google" | "facebook";
  action: ReturnType<typeof useAuthAction>;
}): ReactElement {
  const [unavailable, setUnavailable] = useState(false);
  const providerName = provider === "google" ? "Google" : "Facebook";
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={action.isPending}
        aria-label={`Đăng nhập bằng ${providerName}`}
        onClick={() => {
          if (!isMockApi) {
            setUnavailable(true);
            return;
          }
          action.submit({
            kind: "oauth",
            input: { provider },
          });
        }}
      >
        <img
          src={provider === "google" ? google : facebook}
          alt=""
          width={provider === "google" ? 28 : 26}
          height={provider === "google" ? 28 : 26}
        />
        <span>{providerName}</span>
      </Button>
      {unavailable && (
        <Toast
          tone="error"
          message={`Đăng nhập bằng ${providerName} chưa được hỗ trợ. Vui lòng dùng email hoặc số điện thoại.`}
          onClose={() => setUnavailable(false)}
        />
      )}
    </>
  );
}
function Providers({
  action,
}: {
  action: ReturnType<typeof useAuthAction>;
}): ReactElement {
  return (
    <>
      <div className="auth-page__providers">
        {PROVIDERS.map((provider) => (
          <ProviderButton key={provider} provider={provider} action={action} />
        ))}
      </div>
      <div className="auth-page__divider">
        <span>hoặc</span>
      </div>
    </>
  );
}
export function LoginForm(): ReactElement {
  const action = useAuthAction(),
    form = useForm<LoginInput>({
      resolver: zodResolver(loginSchema),
      defaultValues: { email: "", password: "" },
    });
  return (
    <>
      <Providers action={action} />
      <AuthError error={action.error} />
      <form
        noValidate
        onSubmit={form.handleSubmit((input) =>
          action.submit({ kind: "login", input }),
        )}
      >
        <fieldset className="auth-page__fields" disabled={action.isPending}>
          <legend className="auth-page__sr-only">
            Đăng nhập bằng email hoặc số điện thoại
          </legend>
          <LoginFields form={form} />
          {!isMockApi && action.error?.code === "INVALID_CREDENTIALS" && (
            <p className="auth-page__lockout-hint">
              Sai 5 lần liên tiếp sẽ bị khóa 15 phút.
            </p>
          )}
          <div className="auth-page__login-options">
            <label>
              <input type="checkbox" /> Ghi nhớ đăng nhập
            </label>
            <Link to={ROUTES.forgotPassword}>Quên mật khẩu?</Link>
          </div>
          <Button type="submit" isLoading={action.isPending}>
            Đăng nhập
          </Button>
        </fieldset>
      </form>
      {isMockApi ? <DemoAccounts /> : null}
    </>
  );
}
function LoginFields({
  form,
}: {
  form: UseFormReturn<LoginInput>;
}): ReactElement {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <>
      <Input
        className="auth-page__control auth-page__control--identity"
        label="Email hoặc số điện thoại"
        placeholder="Email hoặc số điện thoại"
        type="text"
        autoComplete="username"
        maxLength={254}
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <Input
        className="auth-page__control auth-page__control--password"
        label="Mật khẩu"
        placeholder="••••••••••"
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        maxLength={128}
        error={form.formState.errors.password?.message}
        trailingControl={
          <button
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="auth-page__visibility"
            type="button"
            onClick={() => setShowPassword((value) => !value)}
          />
        }
        {...form.register("password")}
      />
    </>
  );
}
function DemoAccounts(): ReactElement {
  return (
    <details className="auth-page__demo">
      <summary>Tài khoản thử nghiệm</summary>
      <p>Khách: test+review@example.invalid</p>
      <p>Mật khẩu công khai cho bản mô phỏng: BlueDemo2026</p>
      <p>Không nhập mật khẩu thật.</p>
    </details>
  );
}
