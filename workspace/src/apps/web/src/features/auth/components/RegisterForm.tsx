import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import type { ReactElement } from "react";
import { Link } from "react-router";

import { registerSchema } from "@/features/auth/schemas/auth.schema";
import type { RegisterInput } from "@/features/auth/repositories/authRepository";
import { useAuthAction } from "@/features/auth/hooks/useAuthAction";
import {
  AuthError,
  NeutralSuccess,
} from "@/features/auth/components/AuthFeedback";
import { Input } from "@/shared/ui/Input/Input";
import { Button } from "@/shared/ui/Button/Button";
import { ROUTES } from "@/shared/config/routes";

interface Field {
  name: keyof RegisterInput;
  label: string;
  type?: string;
  autoComplete: string;
  maxLength: number;
  icon: string;
  placeholder: string;
}
const FIELDS: readonly Field[] = [
  {
    name: "fullName",
    label: "Họ và tên",
    autoComplete: "name",
    maxLength: 100,
    icon: "name",
    placeholder: "Nguyễn Văn An",
  },
  {
    name: "phone",
    label: "Số điện thoại",
    type: "tel",
    autoComplete: "tel",
    maxLength: 20,
    icon: "phone",
    placeholder: "0901 234 567",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    autoComplete: "email",
    maxLength: 254,
    icon: "email",
    placeholder: "ten@email.com",
  },
  {
    name: "password",
    label: "Mật khẩu",
    type: "password",
    autoComplete: "new-password",
    maxLength: 128,
    icon: "password",
    placeholder: "••••••••••",
  },
  {
    name: "confirmPassword",
    label: "Xác nhận mật khẩu",
    type: "password",
    autoComplete: "new-password",
    maxLength: 128,
    icon: "password",
    placeholder: "••••••••••",
  },
];
function RegisterFields({
  form,
}: {
  form: UseFormReturn<RegisterInput>;
}): ReactElement {
  return (
    <div className="auth-page__registration">
      {FIELDS.map(({ name, icon, ...props }) => (
        <div
          className={
            name === "email"
              ? "auth-page__registration-field auth-page__registration-field--wide"
              : "auth-page__registration-field"
          }
          key={name}
        >
          <Input
            {...props}
            className={`auth-page__control auth-page__control--${icon}`}
            error={form.formState.errors[name]?.message}
            {...form.register(name)}
          />
        </div>
      ))}
    </div>
  );
}
export function RegisterForm(): ReactElement {
  const action = useAuthAction(),
    form = useForm<RegisterInput>({
      resolver: zodResolver(registerSchema),
      defaultValues: {
        email: "",
        fullName: "",
        phone: "",
        password: "",
        confirmPassword: "",
      },
    });
  if (action.isSuccess) return <NeutralSuccess />;
  return (
    <>
      <AuthError error={action.error} />
      <form
        noValidate
        onSubmit={form.handleSubmit((input) =>
          action.submit({ kind: "register", input }),
        )}
      >
        <fieldset className="auth-page__fields" disabled={action.isPending}>
          <legend className="auth-page__sr-only">
            Thông tin đăng ký mô phỏng
          </legend>
          <RegisterFields form={form} />
          <p className="auth-page__password-help">
            Tối thiểu 8 ký tự, gồm chữ và số.
          </p>
          <label className="auth-page__terms">
            <input type="checkbox" />
            <span>
              Tôi đồng ý với <a href="#terms">Điều khoản dịch vụ</a> và{" "}
              <a href="#privacy">Chính sách bảo mật</a>
            </span>
          </label>
          <Button type="submit" isLoading={action.isPending}>
            Tạo tài khoản
          </Button>
        </fieldset>
      </form>
      <p className="auth-page__switch">
        Đã có tài khoản? <Link to={ROUTES.login}>Đăng nhập</Link>
      </p>
    </>
  );
}
