import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { RefundRequestsPage } from "@/features/operator/refunds/RefundRequestsPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Hủy vé và hoàn tiền",
    description: "Danh sách theo dõi yêu cầu hủy vé và tiến độ hoàn tiền.",
    noIndex: true,
  });
}
export default function Route(): ReactElement {
  return <RefundRequestsPage />;
}
