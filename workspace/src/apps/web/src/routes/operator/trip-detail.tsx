import { isMockApi } from "@/shared/api/config";
import { BackendTripDetailPage } from "@/features/operator/BackendOperatorPage";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { TripDetailPage } from "@/features/operator/detail/TripDetailPage";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Operator — Chi tiết chuyến",
    description: "Thông tin vận hành và hành khách mô phỏng.",
    noIndex: true,
  });
}
export default function TripDetailRoute(): ReactElement {
  return isMockApi ? <TripDetailPage /> : <BackendTripDetailPage />;
}
