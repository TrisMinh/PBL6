import type { ReactElement, ReactNode } from "react";
import { Link, NavLink } from "react-router";

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
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";

import "./AuthShell.css";

export type AuthMode = "login" | "register" | "forgot";

const AUTH_COPY = {
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

export function AuthShell({
  children,
  mode,
}: {
  children: ReactNode;
  mode: AuthMode;
}): ReactElement {
  const copy = AUTH_COPY[mode];
  return (
    <section className={`auth-page auth-page--${mode}`}>
      <div className="auth-page__shell">
        <div className="auth-page__form-zone">
          <div className="auth-page__topline">
            <Link aria-label="BLUE — Trang chủ" to={ROUTES.home}>
              <BrandLogo placement="auth" />
            </Link>
            <Link className="auth-page__home" to={ROUTES.home}>
              <span aria-hidden>←</span> Về trang chủ
            </Link>
          </div>
          <AuthIntro mode={mode} assistant={copy.assistant} />
          <div className="auth-page__heading">
            <p className="auth-page__eyebrow">{copy.eyebrow}</p>
            <h1 className="auth-page__title">{copy.title}</h1>
            <p className="auth-page__support">{copy.support}</p>
          </div>
          <p className="auth-page__privacy">
            Ứng dụng mô phỏng — không phải tài khoản hay đăng nhập thật.
          </p>
          {children}
        </div>
        <ScenicPanel mode={mode} />
      </div>
    </section>
  );
}

function AuthIntro({
  assistant,
  mode,
}: {
  assistant: string;
  mode: AuthMode;
}): ReactElement {
  return (
    <>
      <nav className="auth-page__tabs" aria-label="Tài khoản">
        <NavLink to={ROUTES.register}>Đăng ký</NavLink>
        <NavLink to={ROUTES.login}>Đăng nhập</NavLink>
      </nav>
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

function ScenicPanel({ mode }: { mode: AuthMode }): ReactElement {
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
    </aside>
  );
}
