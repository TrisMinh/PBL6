import { z } from "zod";
import { driverAttachmentSchema } from "../drivers/drivers.schema";

export const scheduleTripSchema = z
  .object({
    id: z.string().min(1),
    rowVersion: z.number().int().nonnegative().optional(),
    origin: z.string().min(1),
    destination: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    departure: z.string().regex(/^\d{2}:\d{2}$/),
    arrival: z.string().regex(/^\d{2}:\d{2}$/),
    arrivalDate: z.string().optional(),
    pickupStops: z.array(z.string()).optional(),
    dropoffStops: z.array(z.string()).optional(),
    vehicleLabel: z.string(),
    crew: z.string(),
    photo: driverAttachmentSchema.optional(),
    fare: z.number().positive().optional(),
    driver: z
      .object({
        id: z.string().optional(),
        name: z.string(),
        license: z.string(),
        phone: z.string(),
        expires: z.string(),
        avatarUrl: z.string().optional(),
      })
      .optional(),
    passengers: z.number().int().nonnegative(),
    capacity: z.number().int().positive(),
    status: z.enum([
      "boarding",
      "scheduled",
      "draft",
      "departed",
      "in_transit",
      "arrived",
      "completed",
      "cancelled",
    ]),
    scheduleStatus: z
      .enum([
        "draft",
        "scheduled",
        "awaiting_departure",
        "boarding",
        "departed",
        "in_transit",
        "arrived",
        "completed",
        "cancelled",
        "needs_update",
      ])
      .optional(),
    assignment: z.enum(["complete", "missing", "conflict"]),
  })
  .strict();
export const scheduleResponseSchema = z
  .object({ items: z.array(scheduleTripSchema) })
  .strict();
export type ScheduleTrip = z.infer<typeof scheduleTripSchema>;
export interface ScheduleCriteria {
  scope?: "active" | "history" | "all";
  origin?: string;
  destination?: string;
  date?: string;
  status?: string;
  period?: string;
  assignment?: string;
  sort?: string;
}
export function selectSchedule(
  trips: readonly ScheduleTrip[],
  criteria: ScheduleCriteria,
): ScheduleTrip[] {
  const statuses = criteria.status?.split(",").filter(Boolean) ?? [];
  const assignments = criteria.assignment?.split(",").filter(Boolean) ?? [];
  const periods = criteria.period?.split(",").filter(Boolean) ?? [];
  return trips
    .filter((trip) => {
      const hour = Number(trip.departure.split(":")[0]);
      const period =
        hour >= 18
          ? "evening"
          : hour >= 12
            ? "afternoon"
            : hour >= 6
              ? "morning"
              : "";
      return (
        (!criteria.origin || trip.origin === criteria.origin) &&
        (!criteria.destination || trip.destination === criteria.destination) &&
        (!criteria.date || trip.date === criteria.date) &&
        (!statuses.length || statuses.includes(trip.status)) &&
        (!assignments.length || assignments.includes(trip.assignment)) &&
        (!periods.length || periods.includes(period))
      );
    })
    .sort((left, right) =>
      criteria.sort === "earliest"
        ? left.departure.localeCompare(right.departure)
        : criteria.sort === "latest"
          ? right.departure.localeCompare(left.departure)
          : 0,
    );
}
