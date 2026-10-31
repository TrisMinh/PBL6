import { isMockApi } from "@/shared/api/config";
import { LiveRouteEditor } from "@/features/operator/LiveOperatorForms";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { CreateRoutePage } from "@/features/operator/resources/CreateRoutePage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Tạo tuyến mới",
    description: "Khai báo tuyến và điểm đón trả mới.",
    noIndex: true,
  });
}
export default function CreateResourceRoute(): ReactElement {
  return isMockApi ? (
    <CreateRoutePage />
  ) : (
    <LiveRouteEditor />
  );
}
