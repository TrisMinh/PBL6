import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { BookingListPage } from "@/features/admin/transactions/pages/BookingListPage";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Đơn đặt vé",
    description: "Quản lý danh sách đặt vé trên BLUE.",
    noIndex: true,
  });
}
export default function Route(): ReactElement {
  return <BookingListPage />;
}
