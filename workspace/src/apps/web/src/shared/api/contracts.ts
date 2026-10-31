import { z } from "zod";

export const moneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.literal("VND"),
});
export const stopSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullish(),
  sequence: z.number(),
  offsetMinutes: z.number(),
  pickupAllowed: z.boolean(),
  dropoffAllowed: z.boolean(),
});
export const backendTripSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  operatorName: z.string(),
  busType: z.string(),
  amenities: z.array(z.string()),
  departureAt: z.string(),
  arrivalAt: z.string(),
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
  id: z.string().uuid(),
  code: z.string(),
  type: z.string(),
  status: z.string(),
  price: moneySchema,
  rowVersion: z.number(),
});
export const holdSchema = z.object({
  holdToken: z.string(),
  tripId: z.string().uuid(),
  status: z.string(),
  seats: z.array(backendSeatSchema),
  expiresAt: z.string(),
  serverTime: z.string(),
});
export const bookingSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  customerId: z.string().uuid(),
  tripId: z.string().uuid(),
  status: z.string(),
  paymentChannel: z.string(),
  total: z.number(),
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
      seatId: z.string().uuid(),
      fullName: z.string(),
      pickupStopId: z.string().uuid(),
      dropoffStopId: z.string().uuid(),
    }),
  ),
});
export const backendTicketSchema = z.object({
  id: z.string().uuid(),
  publicCode: z.string(),
  bookingId: z.string().uuid(),
  tripId: z.string().uuid(),
  passengerName: z.string(),
  seatCode: z.string(),
  status: z.string(),
  paymentChannel: z.string(),
  qrPayload: z.string().nullish(),
  issuedAt: z.string(),
  checkedInAt: z.string().nullish(),
  rowVersion: z.number(),
});
