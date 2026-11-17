import type { Route } from "../tripWorkflow";

export function routeProvince(name: string): string {
  const value = name.trim().replace(/^tỉnh\s+/i, "");
  if (/seed|station|bến xe/i.test(value)) return "";
  if (/^(?:tp\.?\s*)?đà lạt$/i.test(value)) return "Lâm Đồng";
  if (/^(?:tp\.?\s*)?(hồ chí minh|hcm)$/i.test(value)) return "TP. Hồ Chí Minh";
  return value;
}
export function routeEndpoint(
  route: Route,
  pickup: boolean,
): Route["stops"][number] | undefined {
  const stops = route.stops
    .filter((stop) => (pickup ? stop.pickupAllowed : stop.dropoffAllowed))
    .sort((a, b) => a.sequence - b.sequence);
  return pickup ? stops[0] : stops.at(-1);
}
export function stopChoiceKey(stop?: Route["stops"][number]): string {
  return stop
    ? JSON.stringify([
        stop.name.trim().toLocaleLowerCase("vi"),
        (stop.address ?? "").trim().toLocaleLowerCase("vi"),
      ])
    : "";
}
export interface RouteSelection {
  origin: string;
  destination: string;
  pickup: string;
  dropoff: string;
}
export function selectionForRoute(route?: Route): RouteSelection {
  return route
    ? {
        origin: routeProvince(route.origin),
        destination: routeProvince(route.destination),
        pickup: stopChoiceKey(routeEndpoint(route, true)),
        dropoff: stopChoiceKey(routeEndpoint(route, false)),
      }
    : { origin: "", destination: "", pickup: "", dropoff: "" };
}
export function matchingRoutes(
  routes: Route[],
  selection: RouteSelection,
  stops = true,
): Route[] {
  return routes.filter(
    (route) =>
      routeProvince(route.origin) === selection.origin &&
      routeProvince(route.destination) === selection.destination &&
      (!stops ||
        (!!selection.pickup &&
          !!selection.dropoff &&
          stopChoiceKey(routeEndpoint(route, true)) === selection.pickup &&
          stopChoiceKey(routeEndpoint(route, false)) === selection.dropoff)),
  );
}
