import type { ReactElement } from "react";
import { useParams, type MetaDescriptor } from "react-router";
import { createMeta } from "@/shared/config/seo";
import { BookingDetailPage } from "@/features/admin/transactions/pages/BookingDetailPage";
export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Chi tiết đơn đặt vé",
    description: "Xem thông tin chi tiết đặt vé trên BLUE.",
    noIndex: true,
  });
}
export default function Route(): ReactElement {
  const { bookingId = "" } = useParams();
  return <BookingDetailPage bookingId={bookingId} />;
}
