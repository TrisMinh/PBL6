import { isMockApi } from "@/shared/api/config";
import { LiveRouteEditor } from "@/features/operator/LiveOperatorForms";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { EditRoutePage } from "@/features/operator/resources/EditRoutePage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Chỉnh sửa tuyến",
    description: "Cập nhật tuyến và điểm đón trả.",
    noIndex: true,
  });
}
export default function EditResourceRoute(): ReactElement {
  return isMockApi ? (
    <EditRoutePage />
  ) : (
    <LiveRouteEditor edit />
  );
}
