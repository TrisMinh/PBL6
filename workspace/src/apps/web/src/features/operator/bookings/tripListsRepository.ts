import { apiFetch as fetch } from "@/shared/api/client";
import type { z } from "zod";
import {
  tripListsResponseSchema,
  tripPassengersResponseSchema,
  type TripListFilters,
  type TripPassengersResponse,
} from "./tripLists.schema";
export async function getPassengerTrips(
  filters: TripListFilters,
  signal?: AbortSignal,
): Promise<z.infer<typeof tripListsResponseSchema>> {
  const response = await fetch(
    `/api/v1/operator/passenger-trips?${new URLSearchParams(filters)}`,
    { signal },
  );
  if (!response.ok)
    throw Error("Không tải được danh sách chuyến. Vui lòng thử lại.");
  return tripListsResponseSchema.parse(await response.json());
}
export async function getTripPassengers(
  id: string,
  signal?: AbortSignal,
): Promise<TripPassengersResponse> {
  const response = await fetch(
    `/api/v1/operator/passenger-trips/${encodeURIComponent(id)}/passengers`,
    { signal },
  );
  if (!response.ok)
    throw Error(
      response.status === 404
        ? "Không tìm thấy chuyến này."
        : "Không tải được hành khách. Vui lòng thử lại.",
    );
  return tripPassengersResponseSchema.parse(await response.json());
}
