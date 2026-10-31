import { z } from "zod";

import { contactDraftSchema } from "@/features/booking/schemas/passenger.schema";
import { ticketSummarySchema } from "@/features/payment/schemas/payment.schema";
import { tripSchema } from "@/features/trips/schemas/tripResponse.schema";
import { TICKET_CODE_MAX_LENGTH } from "@/features/tickets/config/access";

export const ticketCodeSchema = z.string().regex(/^BLUE-[A-Z0-9-]{1,128}$/);
export const ticketHistoryFilterSchema = z.enum(["all", "issued", "cancelled"]);
export const lookupTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);
export const lookupRequestSchema = z
  .object({
    bookingCode: z.string().trim().min(1).max(TICKET_CODE_MAX_LENGTH),
    verificationValue: z.string().trim().min(1).max(254),
  })
  .strict();
export function normalizeVerification(input: string): string | null {
  const email = contactDraftSchema.shape.email.safeParse(input);
  if (email.success) return email.data.toLowerCase();
  const phone = contactDraftSchema.shape.phone.safeParse(input);
  if (phone.success)
    return phone.data.startsWith("0")
      ? "+84" + phone.data.slice(1)
      : phone.data;
  return null;
}
export const lookupFormSchema = lookupRequestSchema.extend({
  bookingCode: z.string().trim().toUpperCase().pipe(ticketCodeSchema),
  verificationValue: z
    .string()
    .trim()
    .min(1, "Nhập email hoặc số điện thoại đã đặt vé.")
    .max(254)
    .refine(
      (v) => normalizeVerification(v) !== null,
      "Nhập email hoặc số di động Việt Nam hợp lệ.",
    ),
});
export const lookupAccessSchema = z
  .object({
    token: lookupTokenSchema,
    ticketCodes: z
      .array(ticketCodeSchema)
      .min(1)
      .max(6)
      .refine((codes) => new Set(codes).size === codes.length)
      .readonly(),
    expiresAt: z.iso.datetime(),
  })
  .strict()
  .readonly();
export const ticketDetailSchema = ticketSummarySchema
  .unwrap()
  .extend({ status: z.enum(["issued", "cancelled"]) })
  .extend({
    bookingCode: ticketCodeSchema,
    transactionId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    issuedAt: z.iso.datetime(),
    passenger: z
      .object({ fullName: contactDraftSchema.shape.fullName })
      .readonly(),
    trip: tripSchema.readonly(),
  })
  .refine((v) => v.trip.id === v.tripId && v.fareVnd === v.trip.fareVnd)
  .readonly();
export const ticketHistorySchema = z
  .object({
    items: z.array(ticketDetailSchema).max(600).readonly(),
    total: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (value) =>
      value.total === value.items.length &&
      new Set(value.items.map((ticket) => ticket.ticketCode)).size ===
        value.items.length,
  )
  .readonly();
