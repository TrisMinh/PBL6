import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { RouteManagementPage } from "@/features/operator/resources/RouteManagementPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Tuyến & điểm dừng",
    description: "Quản lý tuyến và điểm đón trả của nhà xe.",
    noIndex: true,
  });
}
export default function Route(): ReactElement {
  return <RouteManagementPage />;
}
