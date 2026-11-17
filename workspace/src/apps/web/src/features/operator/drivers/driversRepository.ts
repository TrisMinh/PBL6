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
const endpoint = "/api/v1/operator/drivers";
function adapt(v: Row, m: Row = {}, user: Row = {}): OperatorDriver {
  return driverSchema.parse({
    ...m,
    id: v.id,
    name: m.name ?? user.fullName ?? v.licenseNumber,
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
    rows("/api/v1/operator/staff", signal),
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
): Promise<OperatorDriver> {
  const current = id
    ? (await rows(endpoint)).find((d) => d.id === id)
    : undefined;
  if (id && !current) throw Error("Không tìm thấy tài xế.");
  const user = current
    ? { userId: current.userId }
    : await request("/api/v1/operator/staff", "POST", {
        fullName: input.name,
        email: input.email,
        phone: input.phone,
        role: "DRIVER",
      });
  let saved = await request(
    id ? `${endpoint}/${id}` : endpoint,
    id ? "PATCH" : "POST",
    {
      userId: user.userId,
      licenseNumber: input.licenseNumber,
      licenseExpiresOn: input.expiresAt,
      expectedVersion: current?.expectedVersion ?? 0,
    },
  );
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
): Promise<OperatorDriver> => save(input);
export const updateDriverProfile = (
  id: string,
  input: UpdateDriverInput,
): Promise<OperatorDriver> => save(input, id);
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
