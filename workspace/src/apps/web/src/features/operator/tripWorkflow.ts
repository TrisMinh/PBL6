import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { getLiveRows, liveQueryKey } from "@/shared/api/liveRequest";
import { readApiSession } from "@/shared/api/session";
const stopSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullish(),
  sequence: z.number(),
  offsetMinutes: z.number(),
  pickupAllowed: z.boolean(),
  dropoffAllowed: z.boolean(),
});
export const routeSchema = z.object({
  id: z.string(),
  name: z.string(),
  origin: z.string(),
  destination: z.string(),
  status: z.string(),
  durationMinutes: z.number().nullish(),
  stops: z.array(stopSchema),
});
export const busSchema = z.object({
  id: z.string(),
  plateNumber: z.string(),
  type: z.string(),
  status: z.string(),
  seats: z.array(z.object({ code: z.string(), enabled: z.boolean() })),
});
export const driverSchema = z.object({
  id: z.string(),
  userId: z.string(),
  licenseNumber: z.string(),
  licenseExpiresOn: z.string(),
  status: z.string(),
  fullName: z.string().optional(),
});
export const tripSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  routeId: z.string().nullish(),
  busId: z.string().nullish(),
  driverId: z.string().nullish(),
  origin: z.string(),
  destination: z.string(),
  departureAt: z.string(),
  arrivalAt: z.string(),
  status: z.string(),
  sellable: z.boolean(),
  rowVersion: z.number(),
  fare: z.object({ amount: z.number(), currency: z.string() }),
  policyVersion: z.string().nullish(),
  stops: z.array(stopSchema),
});
export type Route = z.infer<typeof routeSchema>;
export type Bus = z.infer<typeof busSchema>;
export type Driver = z.infer<typeof driverSchema>;
export type Trip = z.infer<typeof tripSchema>;
export interface TripForm {
  routeId: string;
  busId: string;
  driverId: string;
  departureAt: string;
  arrivalAt: string;
  fare: string;
}
export const emptyTripForm: TripForm = {
  routeId: "",
  busId: "",
  driverId: "",
  departureAt: "",
  arrivalAt: "",
  fare: "",
};
export const lastDraftKey = (): string =>
  `blue-live-operator-last-draft:${readApiSession()?.user.id ?? "anonymous"}`;
export function rememberedTripId(): string {
  try {
    return sessionStorage.getItem(lastDraftKey()) ?? "";
  } catch {
    return "";
  }
}
const selectionKey = (id: string): string => `${lastDraftKey()}:${id}:driver`;
export function rememberTrip(id: string, driverId: string): void {
  try {
    sessionStorage.setItem(lastDraftKey(), id);
    sessionStorage.setItem(selectionKey(id), driverId);
  } catch {
    /* The trip URL and server remain authoritative. */
  }
}
export function rememberedDriver(id: string): string {
  try {
    return sessionStorage.getItem(selectionKey(id)) ?? "";
  } catch {
    return "";
  }
}
export function vietnamLocal(value: string): string {
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 16)
    : "";
}
export function vietnamIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}
export const displayDate = (value: string): string =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
export const busLabel = (bus?: Bus): string =>
  bus
    ? ((
        {
          SLEEPER_34: "Giường nằm",
          CABIN_22: "Cabin",
          STANDARD: "Ghế ngồi",
        } as Record<string, string>
      )[bus.type] ?? bus.type)
    : "Chưa chọn xe";
export const driverLabel = (driver: Driver): string =>
  `${driver.fullName ? driver.fullName + " · " : "GPLX "}${driver.licenseNumber}`;
export function canPublishTrip(): boolean {
  const u = readApiSession()?.user;
  return [
    ...(u?.roles ?? []),
    ...(u?.organizationMemberships ?? [])
      .filter((m) => m.status === "ACTIVE")
      .flatMap((m) => m.roleCodes),
  ].some((r) => r === "OPERATOR_ADMIN" || r === "OPERATOR_SCHEDULER");
}
export function tripInput(form: TripForm): {
  routeId: string;
  busId: string;
  driverId: string;
  departureAt: string;
  arrivalAt: string;
  fare: { amount: number; currency: string };
  policyVersion: string;
} {
  if (
    !form.routeId ||
    !form.busId ||
    !form.driverId ||
    !form.departureAt ||
    !form.arrivalAt ||
    !form.fare.trim()
  )
    throw Error("Vui lòng nhập đủ tuyến, xe, tài xế, thời gian và giá vé.");
  const departureAt = vietnamIso(form.departureAt),
    arrivalAt = vietnamIso(form.arrivalAt);
  if (Date.parse(arrivalAt) <= Date.parse(departureAt))
    throw Error("Giờ đến phải sau giờ đi.");
  const amount = Number(form.fare);
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw Error("Giá vé phải là số nguyên lớn hơn 0.");
  return {
    routeId: form.routeId,
    busId: form.busId,
    driverId: form.driverId,
    departureAt,
    arrivalAt,
    fare: { amount, currency: "VND" },
    policyVersion: "cancel-mvp-v1",
  };
}
export function useTripResources(): {
  routes: UseQueryResult<Route[], Error>;
  buses: UseQueryResult<Bus[], Error>;
  drivers: UseQueryResult<Driver[], Error>;
  pending: boolean;
  error: Error | null;
} {
  const routes = useQuery({
    queryKey: liveQueryKey("operator-routes"),
    queryFn: async ({ signal }) =>
      z
        .array(routeSchema)
        .parse(await getLiveRows("/api/v1/operator/routes", signal)),
  });
  const buses = useQuery({
    queryKey: liveQueryKey("operator-buses"),
    queryFn: async ({ signal }) =>
      z
        .array(busSchema)
        .parse(await getLiveRows("/api/v1/operator/buses", signal)),
  });
  const drivers = useQuery({
    queryKey: liveQueryKey("operator-drivers"),
    queryFn: async ({ signal }) =>
      z
        .array(driverSchema)
        .parse(await getLiveRows("/api/v1/operator/drivers", signal)),
  });
  return {
    routes,
    buses,
    drivers,
    pending: routes.isPending || buses.isPending || drivers.isPending,
    error: routes.error ?? buses.error ?? drivers.error,
  };
}
export function useOperatorTrip(id: string): UseQueryResult<Trip, Error> {
  return useQuery({
    queryKey: liveQueryKey("operator-trip-workflow", id),
    queryFn: async ({ signal }) => {
      const rows = await getLiveRows("/api/v1/operator/trips", signal);
      const found = rows.find((row) => row.id === id);
      if (!found) throw Error("Không tìm thấy chuyến trong nhà xe của bạn.");
      return tripSchema.parse(found);
    },
    enabled: !!id,
    retry: false,
  });
}
export function resourceIssues(
  bus: Bus | undefined,
  driver: Driver | undefined,
  arrivalAt: string,
  route?: Route,
): string[] {
  const issues: string[] = [];
  if (route?.status !== "ACTIVE")
    issues.push("Tuyến chưa được chọn hoặc đã ngừng hoạt động.");
  if (bus?.status !== "ACTIVE")
    issues.push("Xe chưa được chọn hoặc không còn hoạt động.");
  if (!bus?.seats.some((seat) => seat.enabled))
    issues.push("Xe chưa có ghế được phép bán.");
  if (driver?.status !== "ACTIVE")
    issues.push("Tài xế chưa được chọn hoặc không còn hoạt động.");
  if (
    driver &&
    arrivalAt &&
    Number.isFinite(Date.parse(arrivalAt)) &&
    driver.licenseExpiresOn < new Date(arrivalAt).toISOString().slice(0, 10)
  )
    issues.push("GPLX của tài xế hết hạn trước khi kết thúc chuyến.");
  return issues;
}
export const getPublicTrip = (
  id: string,
  signal?: AbortSignal,
): Promise<Trip> =>
  apiJson(`/api/v1/trips/${encodeURIComponent(id)}`, tripSchema, { signal });
