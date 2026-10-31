import { isMockApi } from "@/shared/api/config";
import { BackendOperatorPage } from "@/features/operator/BackendOperatorPage";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { RecentBookingsPage } from "@/features/operator/bookings/RecentBookingsPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Đặt chỗ & giao dịch",
    description: "Danh sách đặt chỗ gần đây của nhà xe.",
    noIndex: true,
  });
}
export default function OperatorBookingsRoute(): ReactElement {
  return isMockApi ? (
    <RecentBookingsPage />
  ) : (
    <BackendOperatorPage resource="bookings" />
  );
}
