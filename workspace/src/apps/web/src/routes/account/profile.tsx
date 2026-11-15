import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { CustomerPreferencesPage } from "@/features/account/CustomerPreferencesPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Hồ sơ cá nhân",
    description: "Quản lý hồ sơ khách hàng BLUE.",
    noIndex: true,
  });
}

export default function ProfileRoute(): ReactElement {
  return <CustomerPreferencesPage view="profile" />;
}
