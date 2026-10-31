import { isMockApi } from "@/shared/api/config";
import { BackendManifestPage } from "@/features/operator/BackendOperatorPage";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { PassengerManifestPage } from "@/features/operator/bookings/PassengerManifestPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Danh sách hành khách",
    description: "Hành khách trên chuyến xe của nhà xe.",
    noIndex: true,
  });
}
export default function PassengerManifestRoute(): ReactElement {
  return isMockApi ? <PassengerManifestPage /> : <BackendManifestPage />;
}
