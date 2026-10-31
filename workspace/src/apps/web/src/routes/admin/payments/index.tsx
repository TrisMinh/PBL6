import { isMockApi } from "@/shared/api/config";
import { BackendAdminPage } from "@/features/admin/BackendAdminPage";
import type { ReactElement } from "react";
import { useSearchParams, type MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { PaymentListPage } from "@/features/admin/transactions/pages/PaymentListPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Thanh toán",
    description: "Quản lý danh sách thanh toán trên BLUE.",
    noIndex: true,
  });
}

export default function PaymentsRoute(): ReactElement {
  const [search] = useSearchParams();
  if (isMockApi) return <PaymentListPage />;
  return (
    <BackendAdminPage
      resource={search.get("view") === "settlements" ? "settlements" : "payments"}
    />
  );
}
