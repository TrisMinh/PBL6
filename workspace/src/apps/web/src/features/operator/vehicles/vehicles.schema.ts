import { z } from "zod";

export const VEHICLE_TYPES = [
  { name: "Giường nằm 40 chỗ", capacity: 40, decks: 2 },
  { name: "Limousine 11 chỗ", capacity: 11, decks: 1 },
  { name: "Ghế ngồi 29 chỗ VIP", capacity: 29, decks: 1 },
  { name: "Limousine 10 chỗ", capacity: 10, decks: 1 },
  { name: "Limousine 24 chỗ", capacity: 24, decks: 1 },
  { name: "Giường nằm 36 chỗ", capacity: 36, decks: 2 },
  { name: "Limousine giường 34 chỗ", capacity: 34, decks: 2 },
  { name: "Limousine giường 30 chỗ", capacity: 30, decks: 2 },
  { name: "Limousine giường 24 chỗ", capacity: 24, decks: 2 },
  { name: "Limousine giường 22 chỗ", capacity: 22, decks: 2 },
  { name: "Giường phòng 24 chỗ", capacity: 24, decks: 2 },
  { name: "Giường phòng 21 chỗ", capacity: 21, decks: 2 },
  { name: "Cabin 24 phòng", capacity: 24, decks: 2 },
  { name: "Cabin 21–22 phòng", capacity: 22, decks: 2 },
  { name: "Limousine 22 cabin", capacity: 22, decks: 2 },
] as const;
export const vehicleInputSchema = z.object({
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]-\d{3}\.\d{2}$/),
  type: z
    .number()
    .int()
    .min(0)
    .max(VEHICLE_TYPES.length - 1),
});
export const seatPermissionSchema = z.object({ enabled: z.boolean() });
export const vehicleSchema = vehicleInputSchema
  .extend({
    id: z.string().min(1),
    disabledSeats: z.array(z.string()).max(100),
    lowerRooms: z.union([z.literal(10), z.literal(11)]).optional(),
    cabinCapacity: z.union([z.literal(21), z.literal(22)]).optional(),
    rearSeats: z
      .union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
      .optional(),
    assignment: z
      .object({
        code: z.string(),
        origin: z.string(),
        destination: z.string(),
        time: z.string(),
      })
      .nullable(),
  })
  .superRefine((vehicle, ctx) => {
    if (vehicle.type !== 11 && vehicle.lowerRooms !== undefined)
      ctx.addIssue({
        code: "custom",
        message: "Cấu hình tầng không hợp lệ cho loại xe",
        path: ["lowerRooms"],
      });
    if (vehicle.type !== 13 && vehicle.cabinCapacity !== undefined)
      ctx.addIssue({
        code: "custom",
        message: "Cấu hình cabin không hợp lệ cho loại xe",
        path: ["cabinCapacity"],
      });
    const codes = vehicleSeatCodes(
      vehicle.type,
      vehicle.rearSeats,
      vehicle.cabinCapacity,
      vehicle.lowerRooms,
    );
    if (
      vehicle.rearSeats !== undefined &&
      ((vehicle.type !== 1 &&
        vehicle.type !== 2 &&
        vehicle.type !== 4 &&
        vehicle.type !== 6 &&
        vehicle.type !== 7 &&
        vehicle.type !== 5) ||
        ((vehicle.type === 1 || vehicle.type === 4) && vehicle.rearSeats > 4) ||
        ((vehicle.type === 2 || vehicle.type === 6) && vehicle.rearSeats < 4) ||
        ((vehicle.type === 7 || vehicle.type === 5) && vehicle.rearSeats < 3))
    )
      ctx.addIssue({
        code: "custom",
        message: "Cấu hình hàng cuối không hợp lệ cho loại xe",
        path: ["rearSeats"],
      });
    if (
      new Set(vehicle.disabledSeats).size !== vehicle.disabledSeats.length ||
      vehicle.disabledSeats.some((code) => !codes.includes(code))
    )
      ctx.addIssue({
        code: "custom",
        message: "Vị trí không hợp lệ",
        path: ["disabledSeats"],
      });
  });
export type OperatorVehicle = z.infer<typeof vehicleSchema>;
export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export function vehicleSeatCodes(
  type: number,
  rearSeats?: number,
  cabinCapacity = 22,
  lowerRooms = 10,
): string[] {
  if (type === 11)
    return ["D", "T"].flatMap((prefix) =>
      Array.from(
        { length: prefix === "D" ? lowerRooms : 21 - lowerRooms },
        (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`,
      ),
    );
  if (type === 13)
    return ["D", "T"].flatMap((prefix) =>
      Array.from(
        { length: prefix === "D" ? cabinCapacity - 12 : 12 },
        (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`,
      ),
    );
  if (type === 4)
    return Array.from(
      { length: 21 + (rearSeats ?? 3) },
      (_, index) => `A${String(index + 1).padStart(2, "0")}`,
    );
  if (type === 9 || type === 14)
    return [
      ["D", 10],
      ["T", 12],
    ].flatMap(([prefix, count]) =>
      Array.from(
        { length: Number(count) },
        (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`,
      ),
    );
  if (type === 5)
    return ["D", "T"].flatMap((prefix) =>
      Array.from(
        { length: 15 + (rearSeats ?? 3) },
        (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`,
      ),
    );
  if (type === 6 || type === 7) {
    const perDeck = 12 + (rearSeats ?? (type === 7 ? 3 : 5));
    return ["D", "T"].flatMap((prefix) =>
      Array.from(
        { length: perDeck },
        (_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`,
      ),
    );
  }
  if (type === 2)
    return Array.from(
      { length: 24 + (rearSeats ?? 5) },
      (_, index) => `A${String(index + 1).padStart(2, "0")}`,
    );
  if (type === 1)
    return Array.from(
      { length: 8 + (rearSeats ?? 3) },
      (_, index) => `A${String(index + 1).padStart(2, "0")}`,
    );
  const config = VEHICLE_TYPES[type];
  if (!config) return [];
  const lower =
    config.decks === 1 ? config.capacity : Math.ceil(config.capacity / 2);
  return Array.from({ length: config.capacity }, (_, index) => {
    const upper = index >= lower;
    return `${config.decks === 1 ? "A" : upper ? "T" : "D"}${String(upper ? index - lower + 1 : index + 1).padStart(2, "0")}`;
  });
}

export const rearConfigurationSchema = z.object({
  rearSeats: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
});
export function vehicleCapacity(vehicle: OperatorVehicle): number {
  return vehicleSeatCodes(
    vehicle.type,
    vehicle.rearSeats,
    vehicle.cabinCapacity,
    vehicle.lowerRooms,
  ).length;
}

export const cabinConfigurationSchema = z.object({
  cabinCapacity: z.union([z.literal(21), z.literal(22)]),
});
