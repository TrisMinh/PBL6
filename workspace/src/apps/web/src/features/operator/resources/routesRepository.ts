import {
  rows,
  metadata,
  saveMetadata,
  request,
  type Row,
} from "../liveOriginalApi";
import {
  operatorRouteSchema,
  routeInputSchema,
  type RouteInput,
  type OperatorRoute,
} from "./routes.schema";
const endpoint = "/api/v1/operator/routes";
function adapt(route: Row, extra: Row = {}): OperatorRoute {
  return operatorRouteSchema.parse({
    ...extra,
    id: route.id,
    name: route.name,
    origin: route.origin,
    destination: route.destination,
    region: extra.region ?? `${route.origin} – ${route.destination}`,
    distance: route.distanceKm ?? 0,
    hours: (route.durationMinutes ?? 0) / 60,
    status: route.status === "ACTIVE" ? "active" : "paused",
    updatedAt: route.updatedAt ?? extra.updatedAt ?? "",
    stops: route.stops.map((s: Row, i: number) => ({
      id: s.id,
      name: s.name,
      address: s.address ?? "",
      kind:
        s.pickupAllowed && s.dropoffAllowed
          ? "both"
          : s.pickupAllowed
            ? "pickup"
            : "dropoff",
      km:
        extra.stops?.[i]?.km ??
        (route.durationMinutes
          ? (s.offsetMinutes / route.durationMinutes) * (route.distanceKm ?? 0)
          : 0),
    })),
  });
}
export async function getOperatorRoutes(
  signal?: AbortSignal,
): Promise<OperatorRoute[]> {
  const [routes, extra] = await Promise.all([
    rows(endpoint, signal),
    metadata("routes", signal),
  ]);
  return routes.map((v) => adapt(v, extra[v.id]));
}
export async function saveOperatorRoute(
  input: RouteInput,
  create: boolean,
): Promise<OperatorRoute> {
  const value = routeInputSchema.parse(input);
  const current = create
    ? null
    : (await rows(endpoint)).find((v) => v.id === value.id);
  if (!create && !current) throw Error("Không tìm thấy tuyến.");
  let saved = await request(
    create ? endpoint : `${endpoint}/${value.id}`,
    create ? "POST" : "PATCH",
    {
      name: value.name || `${value.origin} – ${value.destination}`,
      origin: value.origin,
      destination: value.destination,
      distanceKm: value.distance,
      durationMinutes: Math.round(value.hours * 60),
      expectedVersion: current?.expectedVersion ?? 0,
    },
  );
  saved = await request(`${endpoint}/${saved.id}/stops`, "PUT", {
    expectedVersion: saved.expectedVersion,
    stops: value.stops.map((s, i) => ({
      name: s.name,
      address: s.address,
      sequence: i,
      offsetMinutes: Math.round((s.km / value.distance) * value.hours * 60),
      pickupAllowed: s.kind !== "dropoff",
      dropoffAllowed: s.kind !== "pickup",
    })),
  });
  if (value.status === "paused" && saved.status === "ACTIVE")
    saved = await request(`${endpoint}/${saved.id}/deactivate`, "POST", {
      expectedVersion: saved.expectedVersion,
    });
  if (value.status === "active" && saved.status !== "ACTIVE")
    throw Error(
      "Tuyến đã ngừng khai thác. Liên hệ quản trị viên để kích hoạt lại.",
    );
  const extra = { ...value, updatedAt: new Date().toISOString() };
  await saveMetadata("routes", saved.id, extra);
  return adapt(saved, extra);
}
