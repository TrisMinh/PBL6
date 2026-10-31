import { isMockApi } from "@/shared/api/config";
import { LiveDriverEditor } from "@/features/operator/LiveOperatorForms";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { AddDriverPage } from "@/features/operator/drivers/AddDriverPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Thêm tài xế",
    description: "Tạo hồ sơ tài xế và tải giấy phép lái xe.",
    noIndex: true,
  });
}
export default function NewDriverRoute(): ReactElement {
  return isMockApi ? (
    <AddDriverPage />
  ) : (
    <LiveDriverEditor />
  );
}
