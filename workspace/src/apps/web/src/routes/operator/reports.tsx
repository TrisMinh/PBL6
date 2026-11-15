import { isMockApi } from "@/shared/api/config";
import { LiveReportsPage } from "@/features/operator/reports/LiveReportsPage";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { ReportsPage } from "@/features/operator/reports/ReportsPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Báo cáo tổng quan",
    description: "Báo cáo doanh thu và đặt vé của nhà xe.",
    noIndex: true,
  });
}
export default function ReportsRoute(): ReactElement {
  return isMockApi ? <ReportsPage /> : <LiveReportsPage />;
}
