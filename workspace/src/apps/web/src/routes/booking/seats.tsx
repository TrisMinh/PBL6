import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { SeatSelectionPage } from "@/features/booking/pages/SeatSelectionPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Chọn ghế",
    description: "Chọn ghế cho hành trình của bạn.",
    noIndex: true,
  });
}

export default function BookingSeatsRoute(): ReactElement {
  return <SeatSelectionPage />;
}
