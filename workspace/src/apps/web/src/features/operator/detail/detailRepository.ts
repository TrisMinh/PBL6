import { apiFetch as fetch } from "@/shared/api/client";
import {
  tripDetailSchema,
  tripEditSchema,
  type TripDetail,
} from "./detail.schema";
export async function readTrip(
  id: string,
  signal?: AbortSignal,
): Promise<TripDetail> {
  const response = await fetch(
    `/api/v1/operator/schedule-preview/${encodeURIComponent(id)}`,
    { signal },
  );
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "Không tìm thấy chuyến"
        : "Chưa tải được chuyến",
    );
  return tripDetailSchema.parse(await response.json());
}
export async function updateTrip(
  id: string,
  input: unknown,
): Promise<TripDetail> {
  const body = tripEditSchema.parse(input);
  const response = await fetch(
    `/api/v1/operator/schedule-preview/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok)
    throw new Error("Chưa lưu được thay đổi. Vui lòng thử lại.");
  return tripDetailSchema.parse(await response.json());
}
