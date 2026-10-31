import type { ReactElement } from "react";
import type { MetaDescriptor } from "react-router";

import { createMeta } from "@/shared/config/seo";
import { TripResultsPage } from "@/features/trips/pages/TripResultsPage";

export function meta(): MetaDescriptor[] {
  return createMeta({
    title: "Tìm chuyến",
    description: "Tìm chuyến xe phù hợp với hành trình của bạn.",
  });
}

export default function TripsRoute(): ReactElement {
  return <TripResultsPage />;
}
