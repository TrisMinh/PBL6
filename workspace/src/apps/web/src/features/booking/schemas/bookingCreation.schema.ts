import { z } from "zod";

export const bookingAttemptKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9._:-]{1,128}$/);
export const bookingCreationSchema = z
  .object({
    bookingId: z
      .string()
      .min(1)
      .max(128)
      .refine((value) => value === value.trim()),
    bookingCode: z.string().regex(/^BLUE-[A-Z0-9-]{1,64}$/),
    sessionId: z
      .string()
      .min(1)
      .max(128)
      .refine((value) => value === value.trim()),
    totalVnd: z.number().int().positive(),
    status: z.enum(["pending-payment", "confirmed"]),
  })
  .readonly();
