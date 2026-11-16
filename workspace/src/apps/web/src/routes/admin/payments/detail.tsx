import type { ReactElement } from "react";
import { useParams, type MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { PaymentDetailPage } from "@/features/admin/transactions/pages/PaymentDetailPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Chi tiết thanh toán",
    description: "Xem thông tin chi tiết thanh toán trên BLUE.",
    noIndex: true,
  });
}

export default function PaymentDetailRoute(): ReactElement {
  const { paymentId = "" } = useParams();
  return <PaymentDetailPage paymentId={paymentId} />;
}
