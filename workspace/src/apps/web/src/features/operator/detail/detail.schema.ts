import { z } from "zod";
import { scheduleTripSchema } from "../schedule/schedule.schema";
export const passengerSchema = z.object({
  name: z.string(),
  phone: z.string(),
  seat: z.string(),
  pickup: z.string(),
  confirmed: z.boolean(),
});
export const tripDetailSchema = scheduleTripSchema.extend({
  vehicle: z.string(),
  driver: z.string(),
  assistant: z.string(),
  pickup: z.string(),
  dropoff: z.string(),
  note: z.string(),
  passengerList: z.array(passengerSchema),
});
export type TripDetail = z.infer<typeof tripDetailSchema>;
export const tripEditSchema = z
  .object({
    origin: z.string().trim().min(1),
    destination: z.string().trim().min(1),
    date: z.iso.date(),
    departure: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    vehicle: z.string().min(1),
    driver: z.string().min(1),
    assistant: z.string(),
    pickup: z.string().trim().min(1),
    dropoff: z.string().trim().min(1),
    note: z.string().max(1000),
  })
  .strict()
  .refine((d) => d.origin !== d.destination, {
    message: "Điểm đi và điểm đến phải khác nhau.",
  })
  .refine(
    (d) => d.vehicle !== "Chưa phân công" && d.driver !== "Chưa phân công",
    { message: "Chọn phương tiện và tài xế trước khi lưu thay đổi." },
  );
