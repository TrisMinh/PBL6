import { z } from "zod";
import { getLiveRows } from "@/shared/api/liveRequest";

export const liveDriverSchema = z.object({
  id: z.string(),
  userId: z.string(),
  licenseNumber: z.string(),
  licenseExpiresOn: z.string(),
  expectedVersion: z.number(),
  status: z.string(),
  fullName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  licenseClass: z.string().nullable().optional(),
  licenseIssuedOn: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type LiveDriver = z.infer<typeof liveDriverSchema>;
export const getLiveDrivers = async (
  signal?: AbortSignal,
): Promise<LiveDriver[]> =>
  (await getLiveRows("/api/v1/operator/drivers", signal)).map((driver) =>
    liveDriverSchema.parse(driver),
  );
export const driverName = (driver: LiveDriver): string =>
  driver.fullName?.trim() || `GPLX ${driver.licenseNumber}`;
export const driverInitials = (driver: LiveDriver): string =>
  driver.fullName
    ?.trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "TX";
export const driverDate = (value: string | null | undefined): string =>
  value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
export function driverState(
  driver: LiveDriver,
  today: string,
  running = false,
): string {
  if (driver.status === "EXPIRED") return "GPLX hết hạn";
  if (driver.status !== "ACTIVE") return "Tạm ngừng";
  if (driver.licenseExpiresOn.slice(0, 10) < today) return "GPLX hết hạn";
  return running ? "Đang chạy" : "Đang hoạt động";
}
