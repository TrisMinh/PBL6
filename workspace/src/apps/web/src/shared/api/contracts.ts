import { z } from "zod";

export const moneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.literal("VND"),
});
export const stopSchema = z.object({
  id: z.guid(),
  name: z.string(),
  address: z.string().nullish(),
  sequence: z.number(),
  offsetMinutes: z.number(),
  pickupAllowed: z.boolean(),
  dropoffAllowed: z.boolean(),
});
export const backendTripSchema = z.object({
  id: z.guid(),
  organizationId: z.guid(),
  operatorName: z.string(),
  busType: z.string(),
  amenities: z.array(z.string()),
  departureAt: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value).toISOString()),
  arrivalAt: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value).toISOString()),
  origin: z.string(),
  destination: z.string(),
  fare: moneySchema,
  status: z.string(),
  sellable: z.boolean(),
  allowPayLater: z.boolean().optional(),
  availableSeatCount: z.number().nullish(),
  availabilityAsOf: z.string(),
  policyVersion: z.string().nullish(),
  stops: z.array(stopSchema),
  rowVersion: z.number(),
});
export type BackendTrip = z.infer<typeof backendTripSchema>;
export const pageOf = <T extends z.ZodType>(
  item: T,
): z.ZodType<{
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  items: z.output<T>[];
}> =>
  z.object({
    page: z.number(),
    size: z.number(),
    totalElements: z.number(),
    totalPages: z.number(),
    items: z.array(item),
  });
export const backendSeatSchema = z.object({
  id: z.guid(),
  code: z.string(),
  type: z.string(),
  status: z.string(),
  price: moneySchema,
  rowVersion: z.number(),
});
export const holdSchema = z.object({
  holdToken: z.string(),
  tripId: z.guid(),
  status: z.string(),
  seats: z.array(backendSeatSchema),
  expiresAt: z.string(),
  serverTime: z.string(),
});
export const bookingSchema = z.object({
  couponCode: z.string().nullable().optional(),
  seatCodes: z.array(z.string()).nullish(),
  id: z.guid(),
  code: z.string(),
  customerId: z.guid(),
  tripId: z.guid(),
  status: z.string(),
  paymentChannel: z.string(),
  total: z.number(),
  subtotal: z.number().optional(),
  discount: z.number().optional(),
  fee: z.number().optional(),
  currency: z.literal("VND"),
  expiresAt: z.string(),
  rowVersion: z.number(),
  contact: z.object({
    fullName: z.string(),
    email: z.string(),
    phone: z.string(),
  }),
  items: z.array(
    z.object({
      seatId: z.guid(),
      fullName: z.string(),
      pickupStopId: z.guid(),
      dropoffStopId: z.guid(),
    }),
  ),
});
export const backendTicketSchema = z.object({
  journey: z
    .object({
      bookingCode: z.string(),
      seatId: z.guid(),
      pickupStopId: z.guid(),
      dropoffStopId: z.guid(),
    })
    .optional(),
  unitPrice: z.number().optional(),
  seatId: z.guid().optional(),
  bookingItemId: z.guid().optional(),
  id: z.guid(),
  publicCode: z.string(),
  bookingId: z.guid(),
  tripId: z.guid(),
  passengerName: z.string(),
  seatCode: z.string(),
  status: z.string(),
  paymentChannel: z.string(),
  qrPayload: z.string().nullish(),
  issuedAt: z.string(),
  checkedInAt: z.string().nullish(),
  rowVersion: z.number(),
});
