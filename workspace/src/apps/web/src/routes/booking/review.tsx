import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { BookingReviewPage } from "@/features/booking/pages/BookingReviewPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Kiểm tra đặt vé",
    description: "Kiểm tra thông tin hành trình trước khi thanh toán.",
    noIndex: true,
  });
}

export default function BookingReviewRoute(): ReactElement {
  return <BookingReviewPage />;
}
