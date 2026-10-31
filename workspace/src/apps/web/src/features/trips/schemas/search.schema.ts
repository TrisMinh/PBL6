import { z } from "zod";

import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";

const tripSearchFieldsSchema = z.object({
  originId: z.string().trim().min(1, "Chọn điểm đi."),
  destinationId: z.string().trim().min(1, "Chọn điểm đến."),
  departureDate: z
    .string()
    .trim()
    .pipe(z.iso.date("Ngày đi phải có dạng YYYY-MM-DD và tồn tại.")),
  passengerCount: z
    .union([
      z.number(),
      z
        .string()
        .trim()
        .regex(/^[1-6]$/, "Chọn từ 1 đến 6 hành khách."),
    ])
    .transform(Number)
    .pipe(z.number().int().min(1).max(6)),
  sort: z
    .enum(["relevance", "departure", "price-asc", "price-desc"])
    .default("relevance"),
});

// Search dates use the Vietnam calendar day; evaluate the boundary at each parse.
export function createTripSearchSchema(
  getTodayDate: () => string = getVietnamTodayDate,
): typeof tripSearchFieldsSchema {
  return tripSearchFieldsSchema
    .refine((search) => search.originId !== search.destinationId, {
      path: ["destinationId"],
      message: "Điểm đến phải khác điểm đi.",
    })
    .refine((search) => search.departureDate >= getTodayDate(), {
      path: ["departureDate"],
      message: "Ngày đi không được ở quá khứ.",
    });
}

export const tripSearchSchema = createTripSearchSchema();
