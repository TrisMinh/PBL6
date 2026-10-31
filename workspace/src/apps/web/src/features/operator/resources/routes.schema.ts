import { z } from "zod";
export const STOP_KIND = {
  pickup: "Điểm đón",
  dropoff: "Điểm trả",
  both: "Điểm đón & trả",
};
export const stopSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(200),
  kind: z.enum(["pickup", "dropoff", "both"]),
  km: z.number().finite().min(0).max(5000),
});
export const routeInputSchema = z
  .object({
    id: z.string().regex(/^RT-[A-Z0-9-]{3,40}$/),
    name: z.string().trim().min(1).max(100).optional(),
    direction: z.enum(["one-way", "both"]).optional(),
    note: z.string().max(2000).optional(),
    origin: z.string().trim().min(1).max(80),
    destination: z.string().trim().min(1).max(80),
    region: z.string().trim().min(1).max(100),
    distance: z.number().finite().positive().max(5000),
    hours: z.number().finite().min(0.25).max(72),
    status: z.enum(["active", "paused"]),
    stops: z.array(stopSchema).min(2).max(30),
  })
  .strict()
  .refine((route) => route.origin !== route.destination, {
    message: "Điểm đi và điểm đến phải khác nhau.",
  })
  .refine((route) => route.stops.every((stop) => stop.km <= route.distance), {
    message: "Khoảng cách điểm dừng không được vượt chiều dài tuyến.",
  })
  .refine(
    (route) =>
      new Set(route.stops.map((stop) => stop.id)).size === route.stops.length,
    { message: "Mã điểm dừng bị trùng." },
  );
export type RouteInput = z.infer<typeof routeInputSchema>;
export type RouteStop = z.infer<typeof stopSchema>;
export const operatorRouteSchema = routeInputSchema.safeExtend({
  updatedAt: z.iso.datetime(),
});
export type OperatorRoute = z.infer<typeof operatorRouteSchema>;
export const routeResponseSchema = z.object({
  items: z.array(operatorRouteSchema),
});
export const routeFiltersSchema = z.object({
  search: z.string().max(100).default(""),
  region: z.string().max(100).default("all"),
  status: z.enum(["all", "active", "paused"]).default("all"),
  route: z.string().default("RT-HCM-DLI"),
});
export type RouteFilters = z.infer<typeof routeFiltersSchema>;
