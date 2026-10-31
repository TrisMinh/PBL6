import { z } from "zod";
import { passengerSchema } from "../detail/detail.schema";
export const TRIP_LIST_STATUS = {
  boarding: "Đón khách",
  scheduled: "Đã lên lịch",
  conflict: "Có xung đột",
  departing: "Sắp khởi hành",
};
export const tripListSchema = z.object({
  id: z.string(),
  origin: z.string(),
  destination: z.string(),
  date: z.iso.date(),
  departure: z.string(),
  arrival: z.string(),
  vehicle: z.string(),
  booked: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  checkedIn: z.number().int().nonnegative(),
  status: z.enum(["boarding", "scheduled", "conflict", "departing"]),
});
export type PassengerTrip = z.infer<typeof tripListSchema>;
export const tripListFiltersSchema = z.object({
  search: z.string().max(100).default(""),
  date: z.iso.date().default("2026-09-05"),
  route: z.string().max(100).default("all"),
  status: z
    .enum(["all", "boarding", "scheduled", "conflict", "departing"])
    .default("all"),
});
export type TripListFilters = z.infer<typeof tripListFiltersSchema>;
export const tripListsResponseSchema = z.object({
  items: z.array(tripListSchema),
  routes: z.array(z.string()),
});
export const manifestPassengerSchema = passengerSchema.extend({
  ticketCode: z.string(),
  payment: z.enum(["paid", "unpaid"]),
  boardingStatus: z.enum(["confirmed", "waiting", "checked-in"]),
});
export type ManifestPassenger = z.infer<typeof manifestPassengerSchema>;
export const tripPassengersResponseSchema = z.object({
  trip: tripListSchema.extend({ driver: z.string().default("Chưa phân công") }),
  passengers: z.array(manifestPassengerSchema),
});
export type TripPassengersResponse = z.infer<
  typeof tripPassengersResponseSchema
>;
