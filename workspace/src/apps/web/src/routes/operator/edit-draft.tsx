import { isMockApi } from "@/shared/api/config";
import { LiveTripEditor } from "@/features/operator/LiveOperatorForms";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { EditDraftPage } from "@/features/operator/edit/EditDraftPage";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Operator — Chỉnh sửa bản nháp",
    description: "Đổi phân công và kiểm tra lại xung đột chuyến mô phỏng.",
    noIndex: true,
  });
}
export default function EditDraftRoute(): ReactElement {
  return isMockApi ? (
    <EditDraftPage />
  ) : (
    <LiveTripEditor edit />
  );
}
