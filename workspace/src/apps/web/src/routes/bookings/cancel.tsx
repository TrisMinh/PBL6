import { isMockApi } from "@/shared/api/config";
import { BackendCancellationPage } from "@/features/tickets/pages/BackendTicketsPage";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { CancellationPage } from "@/features/cancellation/pages/CancellationPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Hủy vé",
    description: "Kiểm tra thông tin và yêu cầu hủy vé của bạn.",
    noIndex: true,
  });
}

export default function CancelBookingRoute(): ReactElement {
  return isMockApi ? <CancellationPage /> : <BackendCancellationPage />;
}
