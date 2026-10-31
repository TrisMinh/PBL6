import { apiFetch as fetch } from "@/shared/api/client";
import { scheduleResponseSchema, type ScheduleTrip } from "./schedule.schema";

export async function getSchedule(
  signal?: AbortSignal,
): Promise<ScheduleTrip[]> {
  const response = await fetch("/api/v1/operator/schedule-preview", { signal });
  if (!response.ok) throw new Error("Không thể tải lịch chuyến.");
  return scheduleResponseSchema.parse(await response.json()).items;
}
