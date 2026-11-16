import type { MetaDescriptor } from "react-router";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { PaymentListPage } from "@/features/admin/transactions/pages/PaymentListPage";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Thanh toán",
    description: "Quản lý danh sách thanh toán trên BLUE.",
    noIndex: true,
  });
}
export default function Route(): ReactElement {
  return <PaymentListPage />;
}
