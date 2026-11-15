import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { CustomerPreferencesPage } from "@/features/account/CustomerPreferencesPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Cài đặt tài khoản",
    description: "Quản lý tùy chọn tài khoản BLUE.",
    noIndex: true,
  });
}

export default function SettingsRoute(): ReactElement {
  return <CustomerPreferencesPage view="settings" />;
}
