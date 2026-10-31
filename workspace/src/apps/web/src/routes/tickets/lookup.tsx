import { isMockApi } from "@/shared/api/config";
import { BackendTicketLookupPage } from "@/features/tickets/pages/BackendTicketLookupPage";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { TicketLookupPage } from "@/features/tickets/pages/TicketLookupPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Tra cứu vé",
    description: "Tra cứu thông tin vé xe đã đặt cùng BLUE.",
  });
}

export default function TicketLookupRoute(): ReactElement {
  return isMockApi ? <TicketLookupPage /> : <BackendTicketLookupPage />;
}
