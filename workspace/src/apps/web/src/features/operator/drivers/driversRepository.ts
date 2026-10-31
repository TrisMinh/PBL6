import { apiFetch as fetch } from "@/shared/api/client";
import type { UpdateDriverInput } from "./drivers.schema";
import type { CreateDriverInput } from "./drivers.schema";
import {
  driverSchema,
  driversSchema,
  type DriverInput,
  type DriverStatus,
  type OperatorDriver,
} from "./drivers.schema";
const endpoint = "/api/v1/operator/drivers-preview";
async function json(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (!response.ok)
    throw Error(
      typeof body === "object" && body && "message" in body
        ? String(body.message)
        : "Không thể tải dữ liệu tài xế. Vui lòng thử lại.",
    );
  return body;
}
export async function getDrivers(
  signal?: AbortSignal,
): Promise<OperatorDriver[]> {
  return driversSchema.parse(await json(await fetch(endpoint, { signal })));
}
export async function saveDriver(
  input: DriverInput,
  id?: string,
): Promise<OperatorDriver> {
  return driverSchema.parse(
    await json(
      await fetch(id ? `${endpoint}/${encodeURIComponent(id)}` : endpoint, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    ),
  );
}
export async function changeDriverStatus(
  id: string,
  status: DriverStatus,
): Promise<OperatorDriver> {
  return driverSchema.parse(
    await json(
      await fetch(`${endpoint}/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    ),
  );
}

export async function createDriver(
  input: CreateDriverInput,
): Promise<OperatorDriver> {
  return driverSchema.parse(
    await json(
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    ),
  );
}

export async function updateDriverProfile(
  id: string,
  input: UpdateDriverInput,
): Promise<OperatorDriver> {
  return driverSchema.parse(
    await json(
      await fetch(`${endpoint}/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    ),
  );
}
