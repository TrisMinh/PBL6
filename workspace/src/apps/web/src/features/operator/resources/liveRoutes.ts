import { z } from "zod";
import { getLiveRows } from "@/shared/api/liveRequest";

export const liveStopSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  address: z.string().nullable(),
  sequence: z.number(),
  offsetMinutes: z.number(),
  pickupAllowed: z.boolean(),
  dropoffAllowed: z.boolean(),
});
export const liveRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  origin: z.string(),
  destination: z.string(),
  distanceKm: z.number().nullable(),
  durationMinutes: z.number().nullable(),
  expectedVersion: z.number(),
  status: z.string(),
  stops: z.array(liveStopSchema),
});
export type LiveRoute = z.infer<typeof liveRouteSchema>;
export type LiveStop = z.infer<typeof liveStopSchema>;
export const getLiveRoutes = async (
  signal?: AbortSignal,
): Promise<LiveRoute[]> =>
  (await getLiveRows("/api/v1/operator/routes", signal)).map((route) =>
    liveRouteSchema.parse(route),
  );
export const stopKind = (stop: LiveStop): string =>
  stop.pickupAllowed && stop.dropoffAllowed
    ? "Điểm đón & trả"
    : stop.pickupAllowed
      ? "Điểm đón"
      : "Điểm trả";
export const routeStatus = (status: string): string =>
  status === "ACTIVE" ? "Đang khai thác" : "Tạm ngừng";
export const routeDuration = (minutes: number | null): string =>
  minutes === null
    ? "—"
    : `${String(Math.floor(minutes / 60)).padStart(2, "0")} giờ${minutes % 60 ? ` ${minutes % 60} phút` : ""}`;
export const orderedStops = (stops: LiveStop[]): LiveStop[] =>
  [...stops]
    .sort(
      (a, b) => a.offsetMinutes - b.offsetMinutes || a.sequence - b.sequence,
    )
    .map((stop, sequence) => ({ ...stop, sequence }));
