import { isMockApi } from "@/shared/api/config";
import { BackendPaymentReturnPage } from "@/features/payment/pages/BackendPaymentPage";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { VnPayReturnPage } from "@/features/payment/pages/VnPayReturnPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Kết quả thanh toán",
    description: "Kiểm tra kết quả thanh toán cho đặt vé của bạn.",
    noIndex: true,
  });
}

export default function VnPayReturnRoute(): ReactElement {
  return isMockApi ? <VnPayReturnPage /> : <BackendPaymentReturnPage />;
}
