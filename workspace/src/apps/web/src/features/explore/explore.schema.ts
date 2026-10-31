import { z } from "zod";

export const provinceSlugSchema = z
  .string()
  .regex(/^[a-z]+(?:-[a-z]+)*$/)
  .max(80);
const operatorSchema = z
  .object({ id: z.string().min(1), name: z.string().min(1) })
  .strict();
const pointSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    address: z.string().min(1),
    services: z
      .array(z.enum(["pickup", "dropoff"]))
      .min(1)
      .max(2),
    operatorIds: z.array(z.string().min(1)).min(1),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    coordinateSource: z.url().nullable(),
  })
  .strict()
  .refine(
    (point) =>
      new Set(point.services).size === point.services.length &&
      ((point.latitude === null &&
        point.longitude === null &&
        point.coordinateSource === null) ||
        (point.latitude !== null &&
          point.longitude !== null &&
          point.coordinateSource !== null)),
  );
export const provinceSummarySchema = z
  .object({
    slug: provinceSlugSchema,
    name: z.string().min(1),
    region: z.string().min(1),
    description: z.string().min(1),
    operatorCount: z.number().int().positive(),
    pickupCount: z.number().int().nonnegative(),
    dropoffCount: z.number().int().nonnegative(),
    isMock: z.literal(true),
  })
  .strict();
export const provinceDetailSchema = provinceSummarySchema
  .extend({
    operators: z.array(operatorSchema).min(1),
    points: z.array(pointSchema),
  })
  .strict()
  .refine(
    (province) =>
      province.operatorCount === province.operators.length &&
      province.pickupCount ===
        province.points.filter((point) => point.services.includes("pickup"))
          .length &&
      province.dropoffCount ===
        province.points.filter((point) => point.services.includes("dropoff"))
          .length &&
      new Set(province.points.map((point) => point.id)).size ===
        province.points.length &&
      province.points.every((point) =>
        point.operatorIds.every((id) =>
          province.operators.some((operator) => operator.id === id),
        ),
      ),
  );
export const provinceListSchema = z
  .object({ items: z.array(provinceSummarySchema) })
  .strict();
export type ProvinceSummary = z.infer<typeof provinceSummarySchema>;
export type ProvinceDetail = z.infer<typeof provinceDetailSchema>;
export type ExplorePoint = ProvinceDetail["points"][number];
