import { apiFetch as fetch } from "@/shared/api/client";
import { z } from "zod";
import {
  vehicleSchema,
  vehicleInputSchema,
  type OperatorVehicle,
  type VehicleInput,
} from "./vehicles.schema";
const ENDPOINT = "/api/v1/operator/vehicles-preview";
export async function getOperatorVehicles(
  signal?: AbortSignal,
): Promise<OperatorVehicle[]> {
  const response = await fetch(ENDPOINT, { signal });
  if (!response.ok)
    throw Error("Không tải được danh sách xe. Vui lòng thử lại.");
  return z
    .object({ items: z.array(vehicleSchema) })
    .parse(await response.json()).items;
}
export async function setVehicleSeatPermission(
  id: string,
  code: string,
  enabled: boolean,
): Promise<OperatorVehicle> {
  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(id)}/seats/${encodeURIComponent(code)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    },
  );
  if (!response.ok) throw Error("Không lưu được quyền đặt. Vui lòng thử lại.");
  return vehicleSchema.parse(await response.json());
}
export async function createOperatorVehicle(
  input: VehicleInput,
): Promise<OperatorVehicle> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vehicleInputSchema.parse(input)),
  });
  if (!response.ok)
    throw Error(
      response.status === 409
        ? "Biển số xe đã tồn tại."
        : "Không thêm được xe. Vui lòng thử lại.",
    );
  return vehicleSchema.parse(await response.json());
}

export async function setVehicleRearConfiguration(
  id: string,
  rearSeats: number,
): Promise<OperatorVehicle> {
  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(id)}/rear-configuration`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rearSeats }),
    },
  );
  if (!response.ok)
    throw Error("Không lưu được cấu hình hàng cuối. Vui lòng thử lại.");
  return vehicleSchema.parse(await response.json());
}

export async function setVehicleCabinConfiguration(
  id: string,
  cabinCapacity: number,
): Promise<OperatorVehicle> {
  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(id)}/cabin-configuration`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cabinCapacity }),
    },
  );
  if (!response.ok)
    throw Error("Không lưu được cấu hình cabin. Vui lòng thử lại.");
  return vehicleSchema.parse(await response.json());
}

export async function setVehicleRoomConfiguration(
  id: string,
  lowerRooms: number,
): Promise<OperatorVehicle> {
  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(id)}/room-configuration`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lowerRooms }),
    },
  );
  if (!response.ok)
    throw Error("Không lưu được cấu hình tầng. Vui lòng thử lại.");
  return vehicleSchema.parse(await response.json());
}
