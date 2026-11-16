import type { MetaDescriptor } from "react-router";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { BackendPaymentReturnPage } from "@/features/payment/pages/BackendPaymentPage";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Kết quả thanh toán SePay",
    description: "Theo dõi thanh toán và vé điện tử của bạn.",
    noIndex: true,
  });
}
export default function SePayRoute(): ReactElement {
  return <BackendPaymentReturnPage />;
}
