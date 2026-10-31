import { z } from "zod";

import type {
  ContactDraft,
  PassengerDraft,
} from "@/features/booking/types/booking";

export interface PassengerFormValues {
  contact: ContactDraft;
  passengers: PassengerDraft[];
}
const MOBILE_PHONE = /^(?:0|\+84)[35789]\d{8}$/;
const fullName = z
  .string()
  .trim()
  .min(2, "Nhập họ và tên từ 2 ký tự.")
  .max(100, "Họ và tên không quá 100 ký tự.");
const phone = z
  .string()
  .max(20, "Số điện thoại không quá 20 ký tự.")
  .trim()
  .regex(MOBILE_PHONE, "Nhập số điện thoại di động Việt Nam hợp lệ.");
const optionalPhone = z
  .string()
  .max(20, "Số điện thoại không quá 20 ký tự.")
  .trim()
  .refine(
    (value) => value === "" || MOBILE_PHONE.test(value),
    "Nhập số điện thoại di động Việt Nam hợp lệ.",
  )
  .transform((value) => value || undefined)
  .optional();
export const contactDraftSchema = z
  .object({
    fullName,
    email: z
      .string()
      .trim()
      .min(1, "Nhập email nhận vé.")
      .max(254, "Email không quá 254 ký tự.")
      .email("Nhập email hợp lệ."),
    phone,
  })
  .strict();
export const passengerDraftSchema = z
  .object({
    seatId: z.string().min(1).max(128),
    fullName,
    phone: optionalPhone,
  })
  .strict();
function copySelectedSeatIds(ids: readonly string[]): string[] {
  const parsed = z
    .array(
      z
        .string()
        .min(1)
        .max(128)
        .refine((id) => id === id.trim()),
    )
    .min(1)
    .max(6)
    .refine((values) => new Set(values).size === values.length)
    .safeParse([...ids]);
  if (!parsed.success)
    throw new Error("Không thể tạo biểu mẫu cho lựa chọn ghế này.");
  return parsed.data;
}
export function createPassengerSchema(
  selectedSeatIds: readonly string[],
): z.ZodType<PassengerFormValues, PassengerFormValues> {
  const selected = copySelectedSeatIds(selectedSeatIds);
  return z
    .object({
      contact: contactDraftSchema,
      passengers: z.array(passengerDraftSchema).min(1).max(6),
    })
    .strict()
    .superRefine((value, context) => {
      const ids = value.passengers.map((passenger) => passenger.seatId);
      if (
        ids.length !== selected.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !selected.includes(id))
      )
        context.addIssue({
          code: "custom",
          path: ["passengers"],
          message: "Lựa chọn ghế đã thay đổi. Vui lòng chọn lại ghế.",
        });
    });
}
