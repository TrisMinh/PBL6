import type { ReactElement } from "react";
import { isMockApi } from "@/shared/api/config";
import { createMeta } from "@/shared/config/seo";
import { MockRefundPage } from "@/features/cancellation/pages/MockRefundPage";
import { LiveRefundPage } from "@/features/cancellation/pages/LiveRefundPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Theo dõi hoàn tiền",
    description: "Xem trạng thái và thông tin yêu cầu hoàn tiền.",
    noIndex: true,
  });
}
export default function RefundRoute(): ReactElement {
  return isMockApi ? <MockRefundPage /> : <LiveRefundPage />;
}
