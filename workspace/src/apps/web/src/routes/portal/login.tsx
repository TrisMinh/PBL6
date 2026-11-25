import { useState, type FormEvent, type ReactElement } from "react";
import { useLocation, useNavigate } from "react-router";
import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlash } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { httpAuthRepository } from "@/features/auth/repositories/httpAuthRepository";
import { AuthShell } from "@/features/auth/components/AuthShell";
import {
  writeMockSession,
  clearMockSession,
} from "@/features/auth/lib/sessionStorage";
import {
  portal,
  portalHome,
  portalRedirect,
  portalSessionKey,
} from "@/shared/config/portal";
import { isMockApi } from "@/shared/api/config";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { createMeta } from "@/shared/config/seo";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: portal === "operator" ? "Đăng nhập nhà xe" : "Đăng nhập quản trị",
    description: "Không gian đăng nhập riêng dành cho BLUE.",
    noIndex: true,
  });
}

export default function PortalLogin(): ReactElement {
  const operator = portal === "operator";
  const label = operator ? "nhà xe" : "quản trị nền tảng";
  const demoEmail = operator
    ? "operator@blue.example.invalid"
    : "admin@blue.example.invalid";
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    setError("");
    setPending(true);
    try {
      if (isMockApi && email.toLowerCase() !== demoEmail)
        throw new Error(`Vui lòng dùng tài khoản ${label} của cổng này.`);
      clearMockSession();
      const session = await httpAuthRepository.login({ email, password });
      if (isMockApi && session.role !== "admin")
        throw new Error("Tài khoản không có quyền truy cập.");
      if (!writeMockSession(session))
        throw new Error(
          "Không lưu được phiên đăng nhập. Hãy cho phép lưu trữ rồi thử lại.",
        );
      window.sessionStorage.setItem(portalSessionKey, portal);
      void navigate(portalRedirect(location.state?.from) || portalHome, {
        replace: true,
      });
    } catch (reason) {
      setError(
        isMockApi && reason instanceof Error
          ? reason.message
          : "Đăng nhập chưa thành công. Kiểm tra thông tin và thử lại.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main>
      <AuthShell mode="login" audience={operator ? "operator" : "admin"}>
        <form onSubmit={(event) => void submit(event)}>
          <fieldset className="auth-page__fields" disabled={pending}>
            <legend className="auth-page__sr-only">Thông tin đăng nhập</legend>
            <Input
              className="auth-page__control auth-page__control--email"
              label="Email"
              name="email"
              placeholder="Nhập email"
              type="email"
              required
              autoComplete="username"
            />
            <Input
              className="auth-page__control auth-page__control--password"
              label="Mật khẩu"
              name="password"
              placeholder="••••••••••"
              type={visible ? "text" : "password"}
              required
              autoComplete="current-password"
              trailingControl={
                <button
                  aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  className="auth-page__visibility"
                  type="button"
                  onClick={() => setVisible((value) => !value)}
                >
                  {visible ? (
                    <EyeSlash size={18} aria-hidden />
                  ) : (
                    <Eye size={18} aria-hidden />
                  )}
                </button>
              }
            />
            {error && (
              <p role="alert" className="auth-page__error">
                {error}
              </p>
            )}
            <Button type="submit" isLoading={pending}>
              Đăng nhập
            </Button>
          </fieldset>
        </form>
      </AuthShell>
    </main>
  );
}
