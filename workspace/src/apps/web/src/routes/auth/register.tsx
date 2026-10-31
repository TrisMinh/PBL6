import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Đăng ký",
    description: "Tạo tài khoản BLUE để quản lý vé và thông tin hành trình.",
    noIndex: true,
  });
}

export default function RegisterRoute(): ReactElement {
  return <RegisterPage />;
}
