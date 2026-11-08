import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { EditDraftPage } from "@/features/operator/edit/EditDraftPage";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Operator — Chỉnh sửa bản nháp",
    description: "Chỉnh sửa thông tin và phân công chuyến trước khi phát hành.",
    noIndex: true,
  });
}
export default function EditDraftRoute(): ReactElement {
  return <EditDraftPage />;
}
