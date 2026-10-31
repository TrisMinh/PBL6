import { z } from "zod";
export const operatorBookingSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  tripId: z.string(),
  origin: z.string(),
  destination: z.string(),
  departureDate: z.iso.date(),
  departureTime: z.string(),
  createdDate: z.iso.date(),
  seat: z.string(),
  amount: z.number().nonnegative(),
  status: z.enum(["confirmed", "pending", "cancelled"]),
  payment: z.enum(["paid", "unpaid", "refunded"]),
});
export type OperatorBooking = z.infer<typeof operatorBookingSchema>;
export const bookingFiltersSchema = z.object({
  search: z.string().max(100).default(""),
  from: z.iso.date().default("2026-08-28"),
  to: z.iso.date().default("2026-09-05"),
  status: z.enum(["all", "confirmed", "pending", "cancelled"]).default("all"),
  payment: z.enum(["all", "paid", "unpaid", "refunded"]).default("all"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type BookingFilters = z.infer<typeof bookingFiltersSchema>;
export const bookingsResponseSchema = z.object({
  items: z.array(operatorBookingSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export const BOOKING_STATUS = {
  confirmed: "Đã xác nhận",
  pending: "Chờ thanh toán",
  cancelled: "Đã hủy",
};
export const PAYMENT_STATUS = {
  paid: "Đã thanh toán",
  unpaid: "Chờ thanh toán",
  refunded: "Đã hoàn tiền",
};
