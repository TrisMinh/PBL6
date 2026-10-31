import { isMockApi } from "@/shared/api/config";
import { LiveOperatorSchedule } from "@/features/operator/LiveOperatorSchedule";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { SchedulePage } from "@/features/operator/schedule/SchedulePage";
import { createMeta } from "@/shared/config/seo";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Operator — Lịch chuyến",
    description: "Lịch chạy và phân công chuyến xe mô phỏng.",
    noIndex: true,
  });
}
export default function OperatorTripsRoute(): ReactElement {
  return isMockApi ? <SchedulePage /> : <LiveOperatorSchedule />;
}
