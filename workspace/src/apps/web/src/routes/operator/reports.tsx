import { isMockApi } from "@/shared/api/config";
import { BackendReportsPage } from "@/features/operator/BackendOperatorPage";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { ReportsPage } from "@/features/operator/reports/ReportsPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Báo cáo tổng quan",
    description: "Báo cáo doanh thu, đặt vé và vị trí xe minh họa.",
    noIndex: true,
  });
}
export default function ReportsRoute(): ReactElement {
  return isMockApi ? <ReportsPage /> : <BackendReportsPage />;
}
