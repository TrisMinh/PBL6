import { z } from "zod";

export const livePaymentSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  status: z.string(),
  amount: z.number(),
  currency: z.literal("VND"),
  provider: z.string(),
  providerAction: z.record(z.string(), z.string()).nullish(),
  rowVersion: z.number().optional(),
  createdAt: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value).toISOString())
    .nullish(),
  organizationId: z.string().nullish(),
});
