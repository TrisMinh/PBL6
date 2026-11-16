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
export default function Route(): ReactElement {
  const { organizationId = "" } = useParams();
  return <OrganizationDetailPage organizationId={organizationId} />;
}
