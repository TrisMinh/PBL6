import { isMockApi } from "@/shared/api/config";
import { BackendAdminDetailPage } from "@/features/admin/BackendAdminPage";
import type { ReactElement } from "react";
import { useParams, type MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { StaffDetailPage } from "@/features/admin/staff/pages/StaffDetailPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Chi tiết nhân viên",
    description: "Xem thông tin chi tiết nhân viên trên BLUE.",
    noIndex: true,
  });
}

export default function StaffDetailRoute(): ReactElement {
  const { staffId = "" } = useParams();
  return isMockApi ? (
    <StaffDetailPage staffId={staffId} />
  ) : (
    <BackendAdminDetailPage resource="users" id={staffId} />
  );
}
