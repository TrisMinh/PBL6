import { getOperatorRoutes } from "./routesRepository";
import type { CataloguePlace } from "./stopCatalogue.schema";
export async function getStopCatalogue(
  origin: string,
  destination: string,
  distance: number,
  signal?: AbortSignal,
): Promise<CataloguePlace[]> {
  const routes = await getOperatorRoutes(signal);
  const unique = new Map<string, CataloguePlace>();
  for (const route of routes)
    for (const stop of route.stops) {
      if (stop.km <= distance)
        unique.set(stop.id, {
          id: stop.id,
          province: route.origin,
          district: route.destination,
          name: stop.name,
          address: stop.address,
          km: stop.km,
        });
    }
  return [...unique.values()].filter(
    (p) =>
      p.province === origin ||
      p.province === destination ||
      p.district === origin ||
      p.district === destination,
  );
}
