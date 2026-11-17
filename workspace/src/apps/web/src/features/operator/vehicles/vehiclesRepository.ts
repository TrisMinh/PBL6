import {
  rows,
  metadata,
  saveMetadata,
  request,
  typeIndex,
  vehicleTypes,
  type Row,
} from "../liveOriginalApi";
import {
  vehicleSchema,
  vehicleInputSchema,
  vehicleSeatCodes,
  type OperatorVehicle,
  type VehicleInput,
} from "./vehicles.schema";
import { stateLabel } from "@/shared/api/livePresentation";
const endpoint = "/api/v1/operator/buses";
function adapt(bus: Row, extra: Row = {}): OperatorVehicle {
  const type = extra.type ?? typeIndex(bus.type);
  const codes = vehicleSeatCodes(
    type,
    extra.rearSeats,
    extra.cabinCapacity,
    extra.lowerRooms,
  );
  const actualSeats = (bus.seats ?? []) as Row[];
  const customLayout =
    actualSeats.length > 0 &&
    (actualSeats.length !== codes.length ||
      actualSeats.some((s) => !codes.includes(s.code)));
  return vehicleSchema.parse({
    ...extra,
    id: bus.id,
    plate: bus.plateNumber,
    type,
    ...(customLayout
      ? {
          actualSeats,
          layoutLabel:
            bus.type === "STANDARD" ? "Xe ghế ngồi" : stateLabel(bus.type),
        }
      : {}),
    disabledSeats: actualSeats
      .filter((s: Row) => !s.enabled)
      .map((s: Row) => s.code),
    assignment: null,
  });
}
export async function getOperatorVehicles(
  signal?: AbortSignal,
): Promise<OperatorVehicle[]> {
  const [b, m] = await Promise.all([
    rows(endpoint, signal),
    metadata("buses", signal),
  ]);
  return b.map((v) => adapt(v, m[v.id]));
}
async function bus(id: string): Promise<Row> {
  const value = (await rows(endpoint)).find((v) => v.id === id);
  if (!value) throw Error("Không tìm thấy xe.");
  return value;
}
async function replace(id: string, extra: Row): Promise<OperatorVehicle> {
  const current = await bus(id);
  const meta = { ...(await metadata("buses"))[id], ...extra };
  const type = meta.type ?? typeIndex(current.type);
  const codes = vehicleSeatCodes(
    type,
    meta.rearSeats,
    meta.cabinCapacity,
    meta.lowerRooms,
  );
  const seats = codes.map((code, i) => ({
    code,
    deck: code.startsWith("T") ? 2 : 1,
    row: Math.floor(i / 3) + 1,
    column: (i % 3) + 1,
    type: vehicleTypes[type],
    enabled: !meta.disabledSeats?.includes(code),
  }));
  const saved = await request(`${endpoint}/${id}/seats`, "PUT", {
    expectedVersion: current.expectedVersion,
    seats,
  });
  await saveMetadata("buses", id, meta);
  return adapt(saved, meta);
}
export async function createOperatorVehicle(
  input: VehicleInput,
): Promise<OperatorVehicle> {
  const value = vehicleInputSchema.parse(input);
  const created = await request(endpoint, "POST", {
    plateNumber: value.plate,
    type: vehicleTypes[value.type],
    amenities: [],
    expectedVersion: 0,
  });
  return replace(created.id, { type: value.type, disabledSeats: [] });
}
export async function setVehicleSeatPermission(
  id: string,
  code: string,
  enabled: boolean,
): Promise<OperatorVehicle> {
  const current = (await getOperatorVehicles()).find((v) => v.id === id);
  if (!current) throw Error("Không tìm thấy xe.");
  if (current.actualSeats) {
    if (!current.actualSeats.some((s) => s.code === code))
      throw Error("Không tìm thấy ghế trên xe.");
    const original = await bus(id);
    const seats = current.actualSeats.map((s) => ({
      ...s,
      enabled: s.code === code ? enabled : s.enabled,
    }));
    const saved = await request(`${endpoint}/${id}/seats`, "PUT", {
      expectedVersion: original.expectedVersion,
      seats,
    });
    return adapt(saved, (await metadata("buses"))[id]);
  }
  return replace(id, {
    disabledSeats: enabled
      ? current.disabledSeats.filter((s) => s !== code)
      : [...new Set([...current.disabledSeats, code])],
  });
}
export const setVehicleRearConfiguration = (
  id: string,
  rearSeats: number,
): Promise<OperatorVehicle> => replace(id, { rearSeats });
export const setVehicleCabinConfiguration = (
  id: string,
  cabinCapacity: number,
): Promise<OperatorVehicle> => replace(id, { cabinCapacity });
export const setVehicleRoomConfiguration = (
  id: string,
  lowerRooms: number,
): Promise<OperatorVehicle> => replace(id, { lowerRooms });
