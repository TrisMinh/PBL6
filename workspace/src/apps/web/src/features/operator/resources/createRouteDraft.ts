import type { OperatorRoute } from "./routes.schema";
import { z } from "zod";
import { stopSchema } from "./routes.schema";
export const CREATE_ROUTE_DRAFT_KEY = "blue-operator-create-route-draft-v1";
export const createRouteDraftSchema = z.object({
  id: z.string().max(43),
  name: z.string().max(100),
  origin: z.string().max(80),
  destination: z.string().max(80),
  region: z.string().max(100),
  distance: z.number().finite().min(0).max(5000),
  hours: z.number().finite().min(0).max(72),
  status: z.enum(["active", "paused"]),
  direction: z.enum(["one-way", "both"]),
  note: z.string().max(2000),
  stops: z.array(stopSchema).max(30),
});
export type CreateRouteDraft = z.infer<typeof createRouteDraftSchema>;
export const CREATE_ROUTE_SAMPLE: CreateRouteDraft = {
  id: "RT-HCM-DLI",
  name: "TP.HCM → Đà Lạt",
  origin: "TP.HCM",
  destination: "Đà Lạt",
  region: "Miền Nam – Tây Nguyên",
  distance: 310,
  hours: 7,
  status: "active",
  direction: "both",
  note: "",
  stops: [
    {
      id: "hcm",
      name: "Bến xe Miền Đông mới",
      address: "TP. Thủ Đức, TP.HCM",
      kind: "pickup",
      km: 0,
    },
    {
      id: "td",
      name: "Ngã tư Thủ Đức",
      address: "TP. Thủ Đức, TP.HCM",
      kind: "pickup",
      km: 18,
    },
    {
      id: "dn",
      name: "Trạm dừng Đồng Nai",
      address: "Long Khánh, Đồng Nai",
      kind: "both",
      km: 85,
    },
    {
      id: "dli",
      name: "Trung tâm Đà Lạt",
      address: "TP. Đà Lạt, Lâm Đồng",
      kind: "dropoff",
      km: 310,
    },
  ],
};
export function loadCreateRouteDraft(): CreateRouteDraft {
  try {
    const raw = sessionStorage.getItem(CREATE_ROUTE_DRAFT_KEY);
    if (raw && raw.length < 50000) {
      const parsed = createRouteDraftSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch {
    /* The form remains usable without browser storage. */
  }
  return structuredClone(CREATE_ROUTE_SAMPLE);
}
export function saveCreateRouteDraft(draft: CreateRouteDraft): boolean {
  try {
    sessionStorage.setItem(
      CREATE_ROUTE_DRAFT_KEY,
      JSON.stringify(createRouteDraftSchema.parse(draft)),
    );
    return true;
  } catch {
    return false;
  }
}

export function draftFromExistingRoute(route: OperatorRoute): CreateRouteDraft {
  return {
    id: route.id,
    name: route.name ?? route.origin + " → " + route.destination,
    origin: route.origin,
    destination: route.destination,
    region: route.region,
    distance: route.distance,
    hours: route.hours,
    status: route.status,
    direction: route.direction ?? "both",
    note: route.note ?? "",
    stops: structuredClone(route.stops),
  };
}
