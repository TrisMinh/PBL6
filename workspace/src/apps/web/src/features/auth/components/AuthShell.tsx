import type { ReactElement, ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { House } from "@phosphor-icons/react/dist/csr/House";

import happy from "@/assets/auth/robot-happy.svg";
import worried from "@/assets/auth/robot-worried.svg";
import scenic from "@/assets/auth/scenic-bus.png";
import storyArrowForgot from "@/assets/auth/story-arrow-forgot.svg";
import storyArrowLogin from "@/assets/auth/story-arrow-login.svg";
import storyArrowRegister from "@/assets/auth/story-arrow-register.svg";
import storyForgot from "@/assets/auth/story-front-forgot.svg";
import storyLogin from "@/assets/auth/story-front-login.svg";
import storyNext from "@/assets/auth/story-next.svg";
import storyPrev from "@/assets/auth/story-prev.svg";
import storyRegister from "@/assets/auth/story-front-register.svg";
import storyStack from "@/assets/auth/story-stack.svg";
import { ROUTES } from "@/shared/config/routes";
import { customerOrigin } from "@/shared/config/portalOrigins";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";

import "./AuthShell.css";
import { isMockApi } from "@/shared/api/config";

export type AuthMode = "login" | "register" | "forgot" | "verify" | "reset";

const AUTH_COPY = {
  verify: {
    eyebrow: "XÁC MINH TÀI KHOẢN",
    title: "Xác minh email",
    support: "Một bước nữa để sẵn sàng cho hành trình mới.",
    assistant: "Mình đã chuẩn bị mã xác minh cho bạn",
  },
  reset: {
    eyebrow: "KHÔI PHỤC TÀI KHOẢN",
    title: "Đặt lại mật khẩu",
    support: "Xác minh và tạo mật khẩu mới để tiếp tục hành trình.",
    assistant: "Cùng bảo vệ tài khoản của bạn nhé",
  },
  login: {
    eyebrow: "TÀI KHOẢN KHÁCH HÀNG",
    title: "Hành trình đang chờ bạn",
    support: "Đăng nhập để tiếp tục",
    assistant: "Chào bạn! Mình giữ hành trình giúp nhé",
  },
  register: {
    eyebrow: "BẮT ĐẦU HÀNH TRÌNH",
    title: "Tạo tài khoản BLUE.",
    support: "Chỉ mất một phút. Bạn sẽ xác minh ở bước tiếp theo.",
    assistant: "Chỉ còn thiếu một chút thôi!",
  },
  forgot: {
    eyebrow: "KHÔI PHỤC TÀI KHOẢN",
    title: "Quên mật khẩu?",
    support:
      "Nhập email hoặc số điện thoại đã đăng ký. BLUE sẽ gửi mã hoặc liên kết đặt lại.",
    assistant: "Đừng lo, mình sẽ giúp bạn quay lại",
  },
} satisfies Record<AuthMode, Record<string, string>>;

const OPERATOR_COPY = {
  eyebrow: "BLUE OPERATOR",
  title: "Đăng nhập nhà xe",
  support: "Sử dụng tài khoản được cấp để vào trang quản lý.",
  assistant: "Cần hỗ trợ? Liên hệ quản trị nhà xe.",
};
const ADMIN_COPY = {
  eyebrow: "BLUE ADMIN",
  title: "Đăng nhập quản trị",
  support: "Dùng tài khoản quản trị được cấp để truy cập hệ thống.",
  assistant: "Cần hỗ trợ? Liên hệ quản trị hệ thống.",
};

export function AuthShell({
  children,
  mode,
  audience = "customer",
}: {
  children: ReactNode;
  mode: AuthMode;
  audience?: "customer" | "operator" | "admin";
}): ReactElement {
  const staff = audience !== "customer";
  const classes = ["auth-page", `auth-page--${mode}`];
  if (staff) classes.push("auth-page--staff");
  const copy =
    audience === "admin"
      ? ADMIN_COPY
      : audience === "operator"
        ? OPERATOR_COPY
        : AUTH_COPY[mode];
  const homeLabel = (
    <>
      <House size={17} aria-hidden /> Về trang chủ
    </>
  );
  return (
    <section className={classes.join(" ")}>
      <div className="auth-page__shell">
        <div className="auth-page__form-zone">
          <div className="auth-page__topline">
            {staff ? (
              <>
                <BrandLogo placement="auth" />
                <a className="auth-page__home" href={customerOrigin()}>
                  {homeLabel}
                </a>
              </>
            ) : (
              <>
                <Link aria-label="BLUE — Trang chủ" to={ROUTES.home}>
                  <BrandLogo placement="auth" />
                </Link>
                <Link className="auth-page__home" to={ROUTES.home}>
                  {homeLabel}
                </Link>
              </>
            )}
          </div>
          <AuthIntro mode={mode} assistant={copy.assistant} showTabs={!staff} />
          <div className="auth-page__heading">
            <p className="auth-page__eyebrow">{copy.eyebrow}</p>
            <h1 className="auth-page__title">{copy.title}</h1>
            <p className="auth-page__support">{copy.support}</p>
          </div>
          {isMockApi && (
            <p className="auth-page__privacy">
              Ứng dụng mô phỏng — không phải tài khoản hay đăng nhập thật.
            </p>
          )}
          {children}
        </div>
        <ScenicPanel mode={mode} audience={audience} />
      </div>
    </section>
  );
}

function AuthIntro({
  assistant,
  mode,
  showTabs,
}: {
  assistant: string;
  mode: AuthMode;
  showTabs: boolean;
}): ReactElement {
  return (
    <>
      {showTabs && (
        <nav className="auth-page__tabs" aria-label="Tài khoản">
          <NavLink to={ROUTES.register}>Đăng ký</NavLink>
          <NavLink to={ROUTES.login}>Đăng nhập</NavLink>
        </nav>
      )}
      <div className="auth-page__assistant">
        <img
          src={mode === "forgot" ? worried : happy}
          alt=""
          width="120"
          height="106"
        />
        <p>{assistant}</p>
      </div>
    </>
  );
}

function ScenicPanel({
  mode,
  audience,
}: {
  mode: AuthMode;
  audience: "customer" | "operator" | "admin";
}): ReactElement {
  const storyFront =
    mode === "login"
      ? storyLogin
      : mode === "register"
        ? storyRegister
        : storyForgot;
  const storyArrow =
    mode === "login"
      ? storyArrowLogin
      : mode === "register"
        ? storyArrowRegister
        : storyArrowForgot;
  return (
    <aside className="auth-page__scenic" aria-label="Khám phá hành trình">
      <img
        className="auth-page__bus"
        src={scenic}
        width="613"
        height="834"
        alt="Xe BLUE trên cung đường núi — ảnh minh họa"
      />
      {audience === "customer" ? (
        <CustomerScenicCopy storyFront={storyFront} storyArrow={storyArrow} />
      ) : (
        <div className="auth-page__staff-caption">
          <h2>
            {audience === "admin" ? "Quản trị nền tảng" : "Điều hành chuyến xe"}
          </h2>
          <p>
            {audience === "admin"
              ? "Quản lý nhà xe, tài khoản và giao dịch."
              : "Quản lý lịch chuyến, đội xe và doanh thu."}
          </p>
        </div>
      )}
    </aside>
  );
}

function CustomerScenicCopy({
  storyFront,
  storyArrow,
}: {
  storyFront: string;
  storyArrow: string;
}): ReactElement {
  return (
    <>
      <div className="auth-page__story-card">
        <img className="auth-page__story-stack" src={storyStack} alt="" />
        <img className="auth-page__story-front" src={storyFront} alt="" />
        <div className="auth-page__story-copy">
          <strong>
            Đúng chuyến,
            <br />
            đúng giờ, đúng giá
          </strong>
          <span>
            Đặt vé nhanh chóng với thông tin
            <br />
            rõ ràng và mức giá tốt
          </span>
        </div>
        <img className="auth-page__story-arrow" src={storyArrow} alt="" />
      </div>
      <div className="auth-page__story">
        <p>KHÁM PHÁ HÀNH TRÌNH</p>
        <h2>Đồng hành. Open way.</h2>
        <p>Mỗi điểm đến mở ra một câu chuyện mới.</p>
        <div className="auth-page__story-nav" aria-hidden="true">
          <img src={storyPrev} alt="" />
          <img src={storyNext} alt="" />
        </div>
      </div>
    </>
  );
}
