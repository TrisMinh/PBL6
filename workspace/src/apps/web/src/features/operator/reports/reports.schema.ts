import { z } from "zod";
export const reportPeriodSchema = z.enum([
  "week1",
  "week2",
  "week3",
  "week4",
  "month",
]);
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
export const reportFiltersSchema = z
  .object({ from: z.iso.date(), to: z.iso.date(), period: reportPeriodSchema })
  .refine(
    (value) =>
      value.from <= value.to &&
      Date.parse(value.to) - Date.parse(value.from) <= 365 * 86400000,
    { message: "Chọn khoảng ngày hợp lệ, tối đa 366 ngày." },
  );
export const reportBookingSchema = z.object({
  id: z.string(),
  name: z.string(),
  route: z.string(),
  departure: z.iso.date(),
  time: z.string(),
  vehicle: z.string(),
  seats: z.string(),
});
export const reportVehicleSchema = z.object({
  id: z.string(),
  name: z.string(),
  plate: z.string(),
  trip: z.string(),
  route: z.string(),
  status: z.enum(["running", "parked"]),
  x: z.number(),
  y: z.number(),
});
export const reportSchema = z.object({
  range: z.object({ from: z.iso.date(), to: z.iso.date() }),
  totals: z.object({
    revenue: z.number().nonnegative(),
    costs: z.number().nonnegative(),
    tickets: z.number().int().nonnegative(),
    customers: z.number().int().nonnegative(),
  }),
  series: z.array(
    z.object({
      date: z.iso.date(),
      revenue: z.number().nonnegative(),
      tickets: z.number().int().nonnegative(),
    }),
  ),
  referenceChart: z.boolean(),
  bookings: z.array(reportBookingSchema),
  vehicles: z.array(reportVehicleSchema),
});
export type OperatorReport = z.infer<typeof reportSchema>;
export type ReportBooking = z.infer<typeof reportBookingSchema>;
export type ReportVehicle = z.infer<typeof reportVehicleSchema>;
