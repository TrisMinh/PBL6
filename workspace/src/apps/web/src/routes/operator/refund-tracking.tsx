import { isMockApi } from "@/shared/api/config";
import { BackendRefundDetailPage } from "@/features/operator/BackendOperatorPage";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { RefundTrackingPage } from "@/features/operator/refunds/RefundTrackingPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Chi tiết hủy vé và hoàn tiền",
    description: "Thông tin yêu cầu hủy vé, policy và tiến độ hoàn tiền.",
    noIndex: true,
  });
}
export default function RefundTrackingRoute(): ReactElement {
  return isMockApi ? (
    <RefundTrackingPage />
  ) : (
    <BackendRefundDetailPage />
  );
}
