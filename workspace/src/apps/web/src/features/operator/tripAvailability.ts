import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";
import { getLiveRows, liveQueryKey } from "@/shared/api/liveRequest";
import { vietnamIso, type Trip } from "./tripWorkflow";

const scheduleSchema = z.object({
  id: z.string(),
  busId: z.string().nullish(),
  driverId: z.string().nullish(),
  departureAt: z.iso.datetime({ offset: true }),
  arrivalAt: z.iso.datetime({ offset: true }),
  status: z.string(),
  origin: z.string().optional(),
  destination: z.string().optional(),
});
export type ScheduleTrip = z.infer<typeof scheduleSchema>;
export interface ScheduleConflicts {
  buses: Map<string, ScheduleTrip[]>;
  drivers: Map<string, ScheduleTrip[]>;
  incompleteDrivers: boolean;
}
const BUS_RESERVED = new Set([
  "SCHEDULED",
  "BOARDING",
  "DEPARTED",
  "IN_TRANSIT",
  "ARRIVED",
]);
const BUFFER_MS = 60 * 60 * 1000;

export function conflictReason(
  trips: readonly ScheduleTrip[],
  window: [number, number] | null,
): "Trùng lịch" | "Sát lịch" {
  return !window ||
    trips.some(
      (trip) =>
        window[0] < Date.parse(trip.arrivalAt) &&
        Date.parse(trip.departureAt) < window[1],
    )
    ? "Trùng lịch"
    : "Sát lịch";
}

export function localTripWindow(
  departure: string,
  arrival: string,
): [number, number] | null {
  if (!departure || !arrival) return null;
  try {
    const start = Date.parse(vietnamIso(departure)),
      end = Date.parse(vietnamIso(arrival));
    return end > start ? [start, end] : null;
  } catch {
    return null;
  }
}

export function scheduleConflicts(
  trips: readonly ScheduleTrip[],
  window: [number, number],
  excludeId = "",
): ScheduleConflicts {
  const result: ScheduleConflicts = {
    buses: new Map(),
    drivers: new Map(),
    incompleteDrivers: false,
  };
  const add = (
    map: Map<string, ScheduleTrip[]>,
    id: string,
    trip: ScheduleTrip,
  ): void => {
    map.set(id, [...(map.get(id) ?? []), trip]);
  };
  for (const trip of trips) {
    if (trip.id === excludeId || trip.status === "DRAFT") continue;
    const start = Date.parse(trip.departureAt),
      end = Date.parse(trip.arrivalAt);
    // Match the server's two buffered, half-open ranges: [departure-1h, arrival+1h).
    if (!(
      window[0] - BUFFER_MS < end + BUFFER_MS &&
      start - BUFFER_MS < window[1] + BUFFER_MS
    ))
      continue;
    if (trip.busId && BUS_RESERVED.has(trip.status))
      add(result.buses, trip.busId, trip);
    // Operator trip SQL only returns driverId for an ACTIVE primary assignment.
    // Do not assume cancellation/completion also deactivates that assignment.
    if (trip.driverId) add(result.drivers, trip.driverId, trip);
    else if (BUS_RESERVED.has(trip.status)) result.incompleteDrivers = true;
  }
  return result;
}

export function useOperatorSchedule(
  enabled: boolean,
): UseQueryResult<ScheduleTrip[], Error> {
  return useQuery({
    queryKey: liveQueryKey("operator-schedule-availability"),
    queryFn: async ({ signal }) =>
      z
        .array(scheduleSchema)
        .parse(await getLiveRows("/api/v1/operator/trips", signal)),
    enabled,
    staleTime: 15000,
    refetchInterval: 30000,
    refetchOnWindowFocus: "always",
    retry: false,
  });
}

export function conflictLabel(
  trips: readonly Pick<Trip, "departureAt" | "arrivalAt">[],
): string {
  const first = trips[0];
  if (!first) return "";
  const format = (value: string): string =>
    new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(value));
  return `${format(first.departureAt)} – ${format(first.arrivalAt)}${trips.length > 1 ? ` và ${trips.length - 1} chuyến khác` : ""}`;
}
