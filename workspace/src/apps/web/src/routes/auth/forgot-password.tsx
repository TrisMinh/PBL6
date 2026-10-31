import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Quên mật khẩu",
    description: "Khôi phục quyền truy cập tài khoản BLUE.",
    noIndex: true,
  });
}

export default function ForgotPasswordRoute(): ReactElement {
  return <ForgotPasswordPage />;
}
