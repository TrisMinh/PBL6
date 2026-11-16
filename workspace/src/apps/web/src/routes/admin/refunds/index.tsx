import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { RefundListPage } from "@/features/admin/transactions/pages/RefundListPage";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Hoàn tiền",
    description: "Quản lý danh sách hoàn tiền trên BLUE.",
    noIndex: true,
  });
}
export default function Route(): ReactElement {
  return <RefundListPage />;
}
