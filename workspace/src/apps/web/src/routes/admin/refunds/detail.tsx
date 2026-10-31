import { isMockApi } from "@/shared/api/config";
import { BackendAdminDetailPage } from "@/features/admin/BackendAdminPage";
import type { ReactElement } from "react";
import { useParams, type MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { RefundDetailPage } from "@/features/admin/transactions/pages/RefundDetailPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Chi tiết hoàn tiền",
    description: "Xem thông tin chi tiết hoàn tiền trên BLUE.",
    noIndex: true,
  });
}

export default function RefundDetailRoute(): ReactElement {
  const { refundId = "" } = useParams();
  return isMockApi ? (
    <RefundDetailPage refundId={refundId} />
  ) : (
    <BackendAdminDetailPage resource="refunds" id={refundId} />
  );
}
