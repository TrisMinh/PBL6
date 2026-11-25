import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { stateLabel } from "@/shared/api/livePresentation";
import { displayCode } from "../components/displayCode";

const driverTripWorkSchema = z.object({
  driverId: z.guid(),
  tripId: z.guid(),
  busId: z.guid(),
  plateNumber: z.string(),
  origin: z.string(),
  destination: z.string(),
  departureAt: z.iso.datetime({ offset: true }),
  arrivalAt: z.iso.datetime({ offset: true }),
  status: z.string(),
  rowVersion: z.number().int().nonnegative(),
  phase: z.enum(["OPERATING", "PENDING", "UPCOMING", "HISTORY"]),
  needsUpdate: z.boolean(),
});

export type DriverTripWork = z.infer<typeof driverTripWorkSchema>;

export function getDriverTripWork(
  mine: boolean,
  signal?: AbortSignal,
): Promise<DriverTripWork[]> {
  return apiJson(
    mine ? "/api/v1/driver/trips" : "/api/v1/operator/drivers/current-trips",
    z.array(driverTripWorkSchema),
    { signal, cache: "no-store" },
  );
}

export function driverTripCode(trip: DriverTripWork): string {
  return displayCode(trip.tripId, "CX");
}

export function driverTripStatus(trip: DriverTripWork): string {
  if (trip.phase === "PENDING") return "Chờ xác nhận khởi hành";
  if (trip.phase === "UPCOMING" && trip.status === "BOARDING")
    return stateLabel("SCHEDULED");
  return stateLabel(trip.status);
}

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "short",
});

export function driverTripTime(value: string): string {
  return dateTime.format(new Date(value));
}
