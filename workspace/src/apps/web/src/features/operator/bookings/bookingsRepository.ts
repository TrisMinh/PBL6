import { apiFetch as fetch } from "@/shared/api/client";
import type { z } from "zod";
import { bookingsResponseSchema, type BookingFilters } from "./bookings.schema";
export async function getOperatorBookings(
  filters: BookingFilters,
  signal?: AbortSignal,
): Promise<z.infer<typeof bookingsResponseSchema>> {
  const params = new URLSearchParams(
    Object.entries(filters).map(([key, value]) => [key, String(value)]),
  );
  const response = await fetch(`/api/v1/operator/bookings-preview?${params}`, {
    signal,
  });
  if (!response.ok)
    throw Error("Không tải được danh sách đặt chỗ. Vui lòng thử lại.");
  return bookingsResponseSchema.parse(await response.json());
}
