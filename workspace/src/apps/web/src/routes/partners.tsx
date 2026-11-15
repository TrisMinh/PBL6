import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { PartnerSalesPage } from "@/features/partners/PartnerSalesPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Mở bán vé trên BLUE",
    description:
      "Tìm hiểu quy trình đăng ký và mở bán vé trực tuyến dành cho nhà xe trên BLUE.",
  });
}

export default function PartnersRoute(): ReactElement {
  return <PartnerSalesPage />;
}
