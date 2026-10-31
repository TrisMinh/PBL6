import { isMockApi } from "@/shared/api/config";
import { LiveAccountPage } from "@/features/account/LiveAccountPage";
import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { AccountTicketsPage } from "@/features/tickets/pages/AccountTicketsPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Vé của tôi",
    description: "Quản lý hồ sơ, vé và đơn đặt vé trong tài khoản BLUE.",
    noIndex: true,
  });
}
export default function AccountTicketsRoute(): ReactElement {
  return isMockApi ? <AccountTicketsPage /> : <LiveAccountPage />;
}
