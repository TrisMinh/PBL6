import { z } from "zod";

const nonemptyText = z.string().trim().min(1);

export const locationSchema = z.object({
  id: nonemptyText,
  name: nonemptyText,
  displayName: nonemptyText,
  province: nonemptyText,
});

export const operatorSummarySchema = z.object({
  id: nonemptyText,
  name: nonemptyText,
});

export const tripSchema = z
  .object({
    id: nonemptyText,
    origin: locationSchema,
    destination: locationSchema,
    operator: operatorSummarySchema,
    displayOperatorName: nonemptyText,
    departureTime: z.iso.datetime(),
    arrivalTime: z.iso.datetime(),
    fareVnd: z.number().int().positive(),
    availableSeatCount: z.number().int().nonnegative(),
    vehicleType: z.enum(["sleeper-34", "cabin-22"]),
    vehicleLabel: nonemptyText,
    originStopName: nonemptyText,
    destinationStopName: nonemptyText,
    amenities: z.array(z.enum(["wifi", "charging", "restroom", "doorPickup"])),
  })
  .refine(
    (trip) => Date.parse(trip.arrivalTime) > Date.parse(trip.departureTime),
    {
      path: ["arrivalTime"],
    },
  );

export const locationsResponseSchema = z.object({
  items: z.array(locationSchema),
});
export const tripSearchResponseSchema = z
  .object({
    items: z.array(tripSchema),
    total: z.number().int().nonnegative(),
  })
  .refine((response) => response.total === response.items.length, {
    path: ["total"],
  });
