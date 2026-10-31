import { isMockApi } from "@/shared/api/config";
import { BackendAdminPage } from "@/features/admin/BackendAdminPage";
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

export default function AdminBookingsRoute(): ReactElement {
  return isMockApi ? (
    <BookingListPage />
  ) : (
    <BackendAdminPage resource="bookings" />
  );
}
