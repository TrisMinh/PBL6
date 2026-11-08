import type { MetaDescriptor } from "react-router";
import { TripSeatsPage } from "@/features/booking/pages/TripSeatsPage";
import { createMeta } from "@/shared/config/seo";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Chọn ghế",
    description: "Chọn ghế cho hành trình của bạn.",
    noIndex: true,
  });
}

export default TripSeatsPage;
