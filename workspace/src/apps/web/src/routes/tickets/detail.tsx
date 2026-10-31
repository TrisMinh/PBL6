import { isMockApi } from "@/shared/api/config";
import { BackendTicketDetailPage } from "@/features/tickets/pages/BackendTicketsPage";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { TicketDetailPage } from "@/features/tickets/pages/TicketDetailPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Chi tiết vé",
    description: "Xem thông tin vé và hành trình của bạn.",
    noIndex: true,
  });
}

export default function TicketDetailRoute(): ReactElement {
  return isMockApi ? <TicketDetailPage /> : <BackendTicketDetailPage />;
}
