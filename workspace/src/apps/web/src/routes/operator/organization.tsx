import type { ReactElement } from "react";
import { isMockApi } from "@/shared/api/config";
import { LiveOrganizationProfile } from "@/features/operator/LiveOrganizationProfile";
import { LiveDriverAssignments } from "@/features/operator/LiveDriverAssignments";
import { OrganizationPage } from "@/features/operator/organization/OrganizationPage";
import { createMeta } from "@/shared/config/seo";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Tổ chức & thành viên",
    description: "Quản lý hồ sơ nhà xe và thành viên.",
    noIndex: true,
  });
}
export default function OperatorOrganizationRoute(): ReactElement {
  return isMockApi ? (
    <OrganizationPage />
  ) : (
    <>
      <header className="operator-schedule__header">
        <h1>Tổ chức &amp; thành viên</h1>
      </header>
      <LiveOrganizationProfile />
      <LiveDriverAssignments />
    </>
  );
}
