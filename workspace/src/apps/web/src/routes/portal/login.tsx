import { useState, type FormEvent, type ReactElement } from "react";
import { Link, useLocation, useNavigate } from "react-router";
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
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";
import "./portal.css";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    try {
      if (isMockApi && email.trim().toLowerCase() !== demoEmail)
        throw new Error(`Vui lòng dùng tài khoản ${label} của cổng này.`);
      clearMockSession();
      const session = await httpAuthRepository.login({
        email: email.trim(),
        password,
      });
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
  const form = (
    <form onSubmit={(event) => void submit(event)}>
      <fieldset
        className={operator ? "auth-page__fields" : undefined}
        disabled={pending}
      >
        <legend
          className={operator ? "auth-page__sr-only" : "portal-login__sr"}
        >
          Thông tin đăng nhập
        </legend>
        <Input
          className={
            operator
              ? "auth-page__control auth-page__control--email"
              : undefined
          }
          label="Email"
          name="email"
          placeholder={operator ? "Nhập email" : undefined}
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          className={
            operator
              ? "auth-page__control auth-page__control--password"
              : undefined
          }
          label="Mật khẩu"
          name="password"
          placeholder={operator ? "••••••••••" : undefined}
          type={visible ? "text" : "password"}
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          trailingControl={
            operator ? (
              <button
                aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="auth-page__visibility"
                type="button"
                onClick={() => setVisible((value) => !value)}
              />
            ) : undefined
          }
        />
        {!operator && (
          <label className="portal-login__show">
            <input
              type="checkbox"
              checked={visible}
              onChange={(event) => setVisible(event.target.checked)}
            />{" "}
            Hiện mật khẩu
          </label>
        )}
        {error && (
          <p role="alert" className="portal-login__error">
            {error}
          </p>
        )}
        <Button type="submit" isLoading={pending}>
          Đăng nhập
        </Button>
      </fieldset>
    </form>
  );
  if (operator) {
    return (
      <main>
        <AuthShell mode="login" audience="operator">
          {form}
        </AuthShell>
      </main>
    );
  }
  return (
    <main className="portal-login">
      <section className="portal-login__story" aria-label="BLUE Admin">
        <BrandLogo placement="header" />
        <div>
          <p className="portal-login__eyebrow">BLUE · ADMIN</p>
          <h1>{"Một nền tảng.\nMọi hành trình trong tầm tay."}</h1>
          <p>
            Quản lý tổ chức, thành viên và giao dịch trong không gian quản trị
            độc lập.
          </p>
        </div>
        <p className="portal-login__footer">
          Rõ ràng từng bước · An tâm từng hành trình
        </p>
      </section>
      <section className="portal-login__form">
        <p className="portal-login__eyebrow">KHÔNG GIAN QUẢN TRỊ</p>
        <h2>Chào mừng trở lại</h2>
        <p>Đăng nhập tài khoản {label} để tiếp tục.</p>
        {form}
        <Link to="/">Về trang đầu</Link>
      </section>
    </main>
  );
}
