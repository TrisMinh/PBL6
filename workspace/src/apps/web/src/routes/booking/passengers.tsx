import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { PassengerDetailsPage } from "@/features/booking/pages/PassengerDetailsPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Thông tin hành khách",
    description: "Nhập thông tin hành khách và người liên hệ.",
    noIndex: true,
  });
}

export default function BookingPassengersRoute(): ReactElement {
  return <PassengerDetailsPage />;
}
