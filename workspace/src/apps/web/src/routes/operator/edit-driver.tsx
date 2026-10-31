import { isMockApi } from "@/shared/api/config";
import { LiveDriverEditor } from "@/features/operator/LiveOperatorForms";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { EditDriverPage } from "@/features/operator/drivers/EditDriverPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Chỉnh sửa hồ sơ tài xế",
    description: "Cập nhật thông tin, giấy phép và trạng thái hồ sơ tài xế.",
    noIndex: true,
  });
}
export default function EditDriverRoute(): ReactElement {
  return isMockApi ? (
    <EditDriverPage />
  ) : (
    <LiveDriverEditor edit />
  );
}
