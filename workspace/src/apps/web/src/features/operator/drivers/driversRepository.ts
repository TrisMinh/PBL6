import {
  rows,
  metadata,
  saveMetadata,
  request,
  type Row,
} from "../liveOriginalApi";
import {
  driverSchema,
  type DriverInput,
  type DriverStatus,
  type OperatorDriver,
  type CreateDriverInput,
  type UpdateDriverInput,
} from "./drivers.schema";
import { ApiError } from "@/shared/api/error";
import { apiJson } from "@/shared/api/client";
import { z } from "zod";
import { isMockApi } from "@/shared/api/config";
const endpoint = "/api/v1/operator/drivers";
const directoryEndpoint = "/api/v1/operator/staff?driverDirectory=true";
const nameText = (value: unknown): string | undefined =>
  typeof value === "string" ? value.trim() || undefined : undefined;

function profileName(
  driver: Row,
  details?: Row,
  account?: Row,
): string | undefined {
  return (
    nameText(details?.name) ??
    nameText(account?.fullName) ??
    nameText(driver.fullName)
  );
}

export async function getDriverResourceRows(
  signal?: AbortSignal,
): Promise<Row[]> {
  if (isMockApi) return rows(endpoint, signal);

  const [drivers, details, accounts] = await Promise.all([
    rows(endpoint, signal),
    metadata("drivers", signal),
    rows(directoryEndpoint, signal).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 403) return [];
      throw error;
    }),
  ]);
  const accountsByUserId = new Map(
    accounts.map((account) => [account.userId, account]),
  );
  return drivers.map((driver) => {
    const profile = details[driver.id];
    const account = accountsByUserId.get(driver.userId);
    return {
      ...driver,
      fullName: profileName(driver, profile, account),
      phone: profile?.phone ?? account?.phone ?? driver.phone,
    };
  });
}

function adapt(v: Row, m: Row = {}, user: Row = {}): OperatorDriver {
  return driverSchema.parse({
    ...m,
    id: v.id,
    accountMembershipId:
      user.status === "ACTIVE" &&
      user.roleCodes?.length === 1 &&
      user.roleCodes[0] === "DRIVER"
        ? user.id
        : undefined,
    name: profileName(v, m, user) ?? v.licenseNumber,
    phone: m.phone ?? user.phone ?? "",
    email: m.email ?? user.email ?? "",
    birthDate: m.birthDate ?? "",
    address: m.address ?? "",
    licenseNumber: v.licenseNumber,
    licenseClass: m.licenseClass ?? "D",
    issuedAt: m.issuedAt ?? "1970-01-01",
    expiresAt: v.licenseExpiresOn,
    joinedAt: m.joinedAt ?? user.createdAt?.slice(0, 10) ?? "1970-01-01",
    status:
      v.status === "ACTIVE"
        ? m.status === "running"
          ? "running"
          : "available"
        : "paused",
  });
}
export async function getDrivers(
  signal?: AbortSignal,
): Promise<OperatorDriver[]> {
  const [drivers, extras, users] = await Promise.all([
    rows(endpoint, signal),
    metadata("drivers", signal),
    rows(directoryEndpoint, signal),
  ]);
  return drivers.map((d) =>
    adapt(
      d,
      extras[d.id],
      users.find((u) => u.userId === d.userId),
    ),
  );
}
async function save(
  input: DriverInput | CreateDriverInput | UpdateDriverInput,
  id?: string,
  initialPassword?: string,
): Promise<OperatorDriver> {
  const current = id
    ? (await rows(endpoint)).find((d) => d.id === id)
    : undefined;
  if (id && !current) throw Error("Không tìm thấy tài xế.");
  const matchingProfile = initialPassword
    ? (await rows(endpoint)).find(
        (driver) => driver.licenseNumber === input.licenseNumber,
      )
    : undefined;
  let user: Row;
  if (current) user = { userId: current.userId };
  else {
    if (matchingProfile) {
      const matchingAccount = (
        await rows("/api/v1/operator/staff?driverDirectory=true")
      ).find((staff) => staff.userId === matchingProfile.userId);
      if (matchingAccount?.email?.toLowerCase() !== input.email.toLowerCase())
        throw Error("Số giấy phép lái xe này đã có trong danh sách.");
    }
    try {
      user = await request("/api/v1/operator/staff", "POST", {
        fullName: input.name,
        email: input.email,
        phone: input.phone,
        role: "DRIVER",
        initialPassword,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        throw Error("Email hoặc số điện thoại đã thuộc một tài khoản khác.", {
          cause: error,
        });
      throw error;
    }
  }
  if (matchingProfile && matchingProfile.userId !== user.userId)
    throw Error("Số giấy phép lái xe này đã có trong danh sách.");
  let saved =
    matchingProfile ??
    (await request(id ? `${endpoint}/${id}` : endpoint, id ? "PATCH" : "POST", {
      userId: user.userId,
      licenseNumber: input.licenseNumber,
      licenseExpiresOn: input.expiresAt,
      expectedVersion: current?.expectedVersion ?? 0,
    }));
  const status = "status" in input ? input.status : "available";
  if (status === "paused" && saved.status !== "INACTIVE")
    saved = await request(`${endpoint}/${saved.id}/deactivate`, "POST", {
      expectedVersion: saved.expectedVersion,
    });
  if (status === "available" && saved.status === "INACTIVE")
    saved = await request(`${endpoint}/${saved.id}/activate`, "POST", {
      expectedVersion: saved.expectedVersion,
    });
  const extra = {
    ...(id ? (await metadata("drivers"))[id] : {}),
    ...input,
    joinedAt: id
      ? (await metadata("drivers"))[id]?.joinedAt
      : new Date().toISOString().slice(0, 10),
  };
  await saveMetadata("drivers", saved.id, extra);
  return adapt(saved, extra, user);
}
export const saveDriver = (
  input: DriverInput,
  id?: string,
): Promise<OperatorDriver> => save(input, id);
export const createDriver = (
  input: CreateDriverInput,
  initialPassword?: string,
): Promise<OperatorDriver> => save(input, undefined, initialPassword);
export const updateDriverProfile = (
  id: string,
  input: UpdateDriverInput,
): Promise<OperatorDriver> => save(input, id);

export function reissueDriverPassword(
  membershipId: string,
): Promise<{ email: string; password: string }> {
  return apiJson(
    `/api/v1/operator/staff/${encodeURIComponent(membershipId)}/driver-password`,
    z.object({ email: z.string(), password: z.string().min(10) }),
    { method: "POST", cache: "no-store" },
  );
}
export async function changeDriverStatus(
  id: string,
  status: DriverStatus,
): Promise<OperatorDriver> {
  const current = (await rows(endpoint)).find((d) => d.id === id);
  if (!current) throw Error("Không tìm thấy tài xế.");
  const action = status === "paused" ? "deactivate" : "activate";
  const saved = await request(`${endpoint}/${id}/${action}`, "POST", {
    expectedVersion: current.expectedVersion,
  });
  const [extras, users] = await Promise.all([
    metadata("drivers"),
    rows("/api/v1/operator/staff"),
  ]);
  // Availability comes from the driver record; clear an older running override.
  const extra =
    extras[id]?.status === "running" ? { ...extras[id], status } : extras[id];
  if (extra && extra !== extras[id]) await saveMetadata("drivers", id, extra);
  return adapt(
    saved,
    extra,
    users.find((user) => user.userId === saved.userId),
  );
}

export async function deleteDriver(id: string): Promise<void> {
  await request(`${endpoint}/${encodeURIComponent(id)}`, "DELETE");
}
