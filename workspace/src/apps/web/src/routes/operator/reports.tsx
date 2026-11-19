import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { OperatorRevenuePage } from "@/features/operator/reports/OperatorRevenuePage";
import { ReportsPage } from "@/features/operator/reports/ReportsPage";
import { isMockApi } from "@/shared/api/config";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Báo cáo nhà xe",
    description: "Phân tích khách, đơn đặt vé, doanh thu và đối soát của nhà xe.",
    noIndex: true,
  });
}
export default function Route(): ReactElement {
  return isMockApi ? <ReportsPage /> : <OperatorRevenuePage />;
}
