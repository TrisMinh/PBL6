import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { LoginPage } from "@/features/auth/pages/LoginPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Đăng nhập",
    description: "Đăng nhập tài khoản BLUE để quản lý hành trình của bạn.",
    noIndex: true,
  });
}

export default function LoginRoute(): ReactElement {
  return <LoginPage />;
}
