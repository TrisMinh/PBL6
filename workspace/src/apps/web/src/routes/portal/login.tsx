import { useState, type FormEvent, type ReactElement } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { httpAuthRepository } from "@/features/auth/repositories/httpAuthRepository";
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
  return createMeta({ title: portal === "operator" ? "Đăng nhập nhà xe" : "Đăng nhập quản trị", description: "Không gian đăng nhập riêng dành cho BLUE.", noIndex: true });
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
        reason instanceof Error
          ? reason.message
          : "Đăng nhập chưa thành công. Hãy thử lại.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="portal-login">
      <section
        className="portal-login__story"
        aria-label={`BLUE ${operator ? "Operator" : "Admin"}`}
      >
        <BrandLogo placement="header" />
        <div>
          <p className="portal-login__eyebrow">
            BLUE · {operator ? "OPERATOR" : "ADMIN"}
          </p>
          <h1>
            {operator
              ? "Vận hành vững vàng.\nHành trình thông suốt."
              : "Một nền tảng.\nMọi hành trình trong tầm tay."}
          </h1>
          <p>
            {operator
              ? "Quản lý lịch chuyến, đội xe, hành khách và doanh thu trong không gian dành riêng cho nhà xe."
              : "Quản lý tổ chức, thành viên và giao dịch trong không gian quản trị độc lập."}
          </p>
        </div>
        <p className="portal-login__footer">
          Rõ ràng từng bước · An tâm từng hành trình
        </p>
      </section>
      <section className="portal-login__form">
        <p className="portal-login__eyebrow">
          KHÔNG GIAN {operator ? "NHÀ XE" : "QUẢN TRỊ"}
        </p>
        <h2>Chào mừng trở lại</h2>
        <p>Đăng nhập tài khoản {label} để tiếp tục.</p>
        <form onSubmit={(event) => void submit(event)}>
          <fieldset disabled={pending}>
            <legend className="portal-login__sr">Thông tin đăng nhập</legend>
            <Input
              label="Email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              label="Mật khẩu"
              type={visible ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <label className="portal-login__show">
              <input
                type="checkbox"
                checked={visible}
                onChange={(event) => setVisible(event.target.checked)}
              />{" "}
              Hiện mật khẩu
            </label>
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
        <Link to="/">Về trang đầu</Link>
      </section>
    </main>
  );
}
