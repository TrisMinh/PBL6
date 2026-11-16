import { isMockApi } from "@/shared/api/config";
import { VnPayPage } from "@/features/payment/pages/VnPayPage";
import type { MetaDescriptor } from "react-router";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { BackendPaymentPage } from "@/features/payment/pages/BackendPaymentPage";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Thanh toán SePay",
    description: "Theo dõi thanh toán và vé điện tử của bạn.",
    noIndex: true,
  });
}
export default function SePayRoute(): ReactElement {
  return isMockApi ? <VnPayPage /> : <BackendPaymentPage />;
}
