import { z } from "zod";
export const passengerFiltersSchema = z.object({
  search: z.string().max(100).default(""),
  pickup: z.string().max(200).default("all"),
  payment: z.enum(["all", "paid", "unpaid"]).default("all"),
  checkIn: z.enum(["all", "confirmed", "waiting", "checked-in"]).default("all"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type PassengerFilters = z.infer<typeof passengerFiltersSchema>;
export const BOARDING_LABEL = {
  confirmed: "Đã xác nhận",
  waiting: "Chờ check-in",
  "checked-in": "Đã check-in",
};
export const normalizePassenger = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s/g, "");
