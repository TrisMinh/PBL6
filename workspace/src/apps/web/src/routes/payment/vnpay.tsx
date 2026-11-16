import { isMockApi } from "@/shared/api/config";
import { BackendPaymentPage } from "@/features/payment/pages/BackendPaymentPage";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { VnPayPage } from "@/features/payment/pages/VnPayPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Thanh toán qua SePay",
    description: "Kiểm tra đặt vé và tiếp tục thanh toán qua SePay.",
    noIndex: true,
  });
}

export default function VnPayRoute(): ReactElement {
  return isMockApi ? <VnPayPage /> : <BackendPaymentPage />;
}
