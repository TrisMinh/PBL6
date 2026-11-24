import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { SchedulePage } from "@/features/operator/schedule/SchedulePage";
import { createMeta } from "@/shared/config/seo";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Operator — Lịch chuyến",
    description: "Lịch chạy và phân công chuyến xe của nhà xe.",
    noIndex: true,
  });
}
export default function Route(): ReactElement {
  return <SchedulePage />;
}
