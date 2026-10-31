import { z } from "zod";
export const REFUND_STATUSES = {
  pending: "Chờ xử lý",
  processing: "Đang hoàn tiền",
  completed: "Đã hoàn tiền",
  exception: "Ngoại lệ",
} as const;
export const REFUND_LEVELS = {
  level1: { label: "Mức 1", description: "Từ 24 giờ trở lên" },
  level2: { label: "Mức 2", description: "Từ 6 đến dưới 24 giờ" },
  level3: { label: "Mức 3", description: "Từ 2 đến dưới 6 giờ" },
  exception: { label: "Không đủ điều kiện", description: "Dưới 2 giờ" },
} as const;
export type RefundLevel = keyof typeof REFUND_LEVELS;
export function cancellationMinutes(
  requestedAt: string,
  departureAt: string,
): number {
  return Math.floor(
    (Date.parse(departureAt) - Date.parse(requestedAt)) / 60000,
  );
}
export function refundLevel(minutes: number): RefundLevel {
  return minutes >= 1440
    ? "level1"
    : minutes >= 360
      ? "level2"
      : minutes >= 120
        ? "level3"
        : "exception";
}
export function refundLeadLabel(minutes: number): string {
  if (minutes <= 0) return "Đã khởi hành";
  const days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60),
    remaining = minutes % 60;
  return [
    days ? `${days} ngày` : "",
    hours ? `${hours} giờ` : "",
    remaining ? `${remaining} phút` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
export const refundRequestSchema = z
  .object({
    bookingCode: z.string().min(1),
    customer: z.string().min(1),
    phone: z.string(),
    bookedTickets: z.number().int().positive(),
    seats: z.array(z.string()).min(1),
    plate: z.string(),
    vehicleType: z.string(),
    tripCode: z.string(),
    route: z.string(),
    requestedAt: z.iso.datetime({ offset: true }),
    departureAt: z.iso.datetime({ offset: true }),
    status: z.enum(["pending", "processing", "completed", "exception"]),
  })
  .refine(
    (v) => v.seats.length <= v.bookedTickets,
    "Số vé hủy không thể vượt quá số vé đặt.",
  );
export const refundFiltersSchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z
    .enum(["all", "pending", "processing", "completed", "exception"])
    .default("all"),
  level: z
    .enum(["all", "level1", "level2", "level3", "exception"])
    .default("all"),
  date: z.union([z.iso.date(), z.literal("")]).default("2026-09-05"),
});
export const refundListSchema = z.object({
  items: z.array(refundRequestSchema),
  total: z.number().int().nonnegative(),
});
export type RefundRequest = z.infer<typeof refundRequestSchema>;
export type RefundFilters = z.infer<typeof refundFiltersSchema>;
export type RefundList = z.infer<typeof refundListSchema>;
