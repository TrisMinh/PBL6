import { z } from "zod";

export const scheduleTripSchema = z
  .object({
    id: z.string().min(1),
    origin: z.string().min(1),
    destination: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    departure: z.string().regex(/^\d{2}:\d{2}$/),
    arrival: z.string().regex(/^\d{2}:\d{2}$/),
    vehicleLabel: z.string(),
    crew: z.string(),
    passengers: z.number().int().nonnegative(),
    capacity: z.number().int().positive(),
    status: z.enum(["boarding", "scheduled", "draft"]),
    assignment: z.enum(["complete", "missing", "conflict"]),
  })
  .strict();
export const scheduleResponseSchema = z
  .object({ items: z.array(scheduleTripSchema) })
  .strict();
export type ScheduleTrip = z.infer<typeof scheduleTripSchema>;
export interface ScheduleCriteria {
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
  return trips
    .filter((trip) => {
      const hour = Number(trip.departure.split(":")[0]);
      return (
        (!criteria.origin || trip.origin === criteria.origin) &&
        (!criteria.destination || trip.destination === criteria.destination) &&
        (!criteria.date || trip.date === criteria.date) &&
        (!criteria.status || trip.status === criteria.status) &&
        (!criteria.assignment || trip.assignment === criteria.assignment) &&
        (!criteria.period ||
          (criteria.period === "morning"
            ? hour >= 6 && hour < 12
            : criteria.period === "afternoon"
              ? hour >= 12 && hour < 18
              : hour >= 18))
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
