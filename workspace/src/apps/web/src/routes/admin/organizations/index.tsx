import { isMockApi } from "@/shared/api/config";
import { BackendAdminPage } from "@/features/admin/BackendAdminPage";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { OrganizationListPage } from "@/features/admin/organizations/pages/OrganizationListPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Tổ chức",
    description: "Quản lý danh sách tổ chức trên BLUE.",
    noIndex: true,
  });
}

export default function OrganizationsRoute(): ReactElement {
  return isMockApi ? (
    <OrganizationListPage />
  ) : (
    <BackendAdminPage resource="organizations" />
  );
}
