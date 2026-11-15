import { isMockApi } from "@/shared/api/config";
import { LiveVehicleManagementPage } from "@/features/operator/vehicles/LiveVehicleManagementPage";
import type { ReactElement } from "react";
import { useSearchParams } from "react-router";
import { LiveVehicleEditor } from "@/features/operator/LiveOperatorForms";
import { createMeta } from "@/shared/config/seo";
import { VehicleManagementPage } from "@/features/operator/vehicles/VehicleManagementPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Xe & sơ đồ ghế",
    description: "Quản lý xe và quyền đặt từng vị trí.",
    noIndex: true,
  });
}
export default function VehiclesRoute(): ReactElement {
  const [search] = useSearchParams();
  if (!isMockApi && (search.has("new") || search.has("edit")))
    return <LiveVehicleEditor />;
  return isMockApi ? <VehicleManagementPage /> : <LiveVehicleManagementPage />;
}
