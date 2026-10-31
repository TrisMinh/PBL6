import { isMockApi } from "@/shared/api/config";
import { BackendAdminPage } from "@/features/admin/BackendAdminPage";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { StaffListPage } from "@/features/admin/staff/pages/StaffListPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Nhân viên",
    description: "Quản lý danh sách nhân viên trên BLUE.",
    noIndex: true,
  });
}

export default function StaffRoute(): ReactElement {
  return isMockApi ? <StaffListPage /> : <BackendAdminPage resource="users" />;
}
