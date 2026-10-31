import { isMockApi } from "@/shared/api/config";
import { BackendAdminDetailPage } from "@/features/admin/BackendAdminPage";
import type { ReactElement } from "react";
import { useParams, type MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { OrganizationDetailPage } from "@/features/admin/organizations/pages/OrganizationDetailPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Chi tiết tổ chức",
    description: "Xem thông tin chi tiết tổ chức trên BLUE.",
    noIndex: true,
  });
}

export default function OrganizationDetailRoute(): ReactElement {
  const { organizationId = "" } = useParams();
  return isMockApi ? (
    <OrganizationDetailPage organizationId={organizationId} />
  ) : (
    <BackendAdminDetailPage resource="organizations" id={organizationId} />
  );
}
