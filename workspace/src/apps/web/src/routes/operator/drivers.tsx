import { isMockApi } from "@/shared/api/config";
import { BackendOperatorPage } from "@/features/operator/BackendOperatorPage";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { DriversPage } from "@/features/operator/drivers/DriversPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Quản lý tài xế",
    description: "Danh sách và hồ sơ tài xế của Operator.",
    noIndex: true,
  });
}
export default function DriversRoute(): ReactElement {
  return isMockApi ? (
    <DriversPage />
  ) : (
    <BackendOperatorPage resource="drivers" />
  );
}
