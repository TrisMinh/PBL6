import { isMockApi } from "@/shared/api/config";
import { apiJson } from "@/shared/api/client";
import { getLiveRows } from "@/shared/api/liveRequest";
import { z } from "zod";
import { vietnamParts } from "../schedule/scheduleRepository";
import { stateLabel } from "@/shared/api/livePresentation";
async function liveTrip(id: string, signal?: AbortSignal): Promise<TripDetail> {
  const [trips, buses, drivers] = await Promise.all(
    ["trips", "buses", "drivers"].map((r) =>
      getLiveRows(`/api/v1/operator/${r}`, signal),
    ),
  );
  const row = trips.find((t) => t.id === id);
  if (!row) throw new Error("Không tìm thấy chuyến");
  const bus = buses.find((b) => b.id === row.busId),
    driver = drivers.find((d) => d.id === row.driverId);
  const manifest =
    row.status === "DRAFT"
      ? { passengers: [] }
      : await apiJson(
          `/api/v1/operator/trips/${encodeURIComponent(id)}/manifest`,
          z.object({
            passengers: z.array(
              z.object({
                passengerName: z.string(),
                seatCode: z.string(),
                pickupStopName: z.string(),
                status: z.string(),
              }),
            ),
          }),
          { signal },
        );
  return {
    id,
    origin: String(row.origin),
    destination: String(row.destination),
    date: vietnamParts(row.departureAt).date,
    departure: vietnamParts(row.departureAt).time,
    arrival: vietnamParts(row.arrivalAt).time,
    vehicleLabel: stateLabel(String(bus?.type ?? row.busType)),
    crew: driver
      ? String(driver.fullName || driver.licenseNumber)
      : "Chưa phân công",
    passengers: manifest.passengers.length,
    capacity:
      bus && Array.isArray(bus.seats)
        ? bus.seats.length
        : Math.max(1, Number(row.availableSeatCount) || 0),
    status:
      row.status === "DRAFT"
        ? "draft"
        : row.status === "BOARDING"
          ? "boarding"
          : "scheduled",
    assignment: bus && driver ? "complete" : "missing",
    vehicle: bus ? String(bus.plateNumber) : "Chưa phân công",
    driver: driver
      ? String(driver.fullName || driver.licenseNumber)
      : "Chưa phân công",
    assistant: "Chưa phân công",
    pickup: String(row.origin),
    dropoff: String(row.destination),
    note: "",
    passengerList: manifest.passengers.map((p) => ({
      name: p.passengerName,
      phone: "—",
      seat: p.seatCode,
      pickup: p.pickupStopName,
      confirmed: p.status === "ISSUED" || p.status === "CHECKED_IN",
    })),
  };
}
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
  if (!isMockApi) return liveTrip(id, signal);
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
