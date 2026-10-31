import { isMockApi } from "@/shared/api/config";
import { BackendOperatorPage } from "@/features/operator/BackendOperatorPage";
import type { ReactElement } from "react";
import { createMeta } from "@/shared/config/seo";
import { TripPassengerListsPage } from "@/features/operator/bookings/TripPassengerListsPage";
export function meta(): ReturnType<typeof createMeta> {
  return createMeta({
    title: "Operator — Danh sách theo chuyến",
    description: "Danh sách chuyến và hành khách của nhà xe.",
    noIndex: true,
  });
}
export default function TripPassengerListsRoute(): ReactElement {
  return isMockApi ? (
    <TripPassengerListsPage />
  ) : (
    <BackendOperatorPage resource="passengerTrips" />
  );
}
