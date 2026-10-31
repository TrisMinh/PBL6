import { isMockApi } from "@/shared/api/config";
import { BackendOperatorPage } from "@/features/operator/BackendOperatorPage";
import type { ReactElement } from "react";
import { useSearchParams } from "react-router";
import { LiveRouteStopsEditor } from "@/features/operator/LiveOperatorForms";
import { createMeta } from "@/shared/config/seo";
import { RouteManagementPage } from "@/features/operator/resources/RouteManagementPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Tuyến & điểm dừng",
    description: "Quản lý tuyến và điểm đón trả của nhà xe.",
    noIndex: true,
  });
}
export default function ResourceRoutesRoute(): ReactElement {
  const [search] = useSearchParams();
  if (!isMockApi && search.has("stops")) return <LiveRouteStopsEditor />;
  return isMockApi ? (
    <RouteManagementPage />
  ) : (
    <BackendOperatorPage resource="routes" />
  );
}
