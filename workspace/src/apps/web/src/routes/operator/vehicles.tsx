import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { VehicleManagementPage } from "@/features/operator/vehicles/VehicleManagementPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Xe & sơ đồ ghế",
    description: "Quản lý xe và quyền đặt từng vị trí.",
    noIndex: true,
  });
}
export default function Route(): ReactElement {
  return <VehicleManagementPage />;
}
