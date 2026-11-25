import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { MyDriverTrips } from "@/features/operator/drivers/MyDriverTrips";

export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Chuyến của tôi — BLUE",
    description: "Lịch phân công và trạng thái chuyến của tài xế.",
    noIndex: true,
  });
}

export default function Route(): ReactElement {
  return <MyDriverTrips />;
}
