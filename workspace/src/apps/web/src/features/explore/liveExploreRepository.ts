import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { backendTripSchema, pageOf } from "@/shared/api/contracts";
import { nextCatalogueDate } from "./liveCataloguePresentation";
import type { ProvinceDetail, ExplorePoint } from "./explore.schema";

const metadata: Record<string, { slug: string; name: string; region: string }> =
  {
    "TP. Hồ Chí Minh": {
      slug: "ho-chi-minh",
      name: "TP. Hồ Chí Minh",
      region: "Miền Nam",
    },
    "Đà Lạt": { slug: "lam-dong", name: "Lâm Đồng", region: "Tây Nguyên" },
    "Đà Nẵng": { slug: "da-nang", name: "Đà Nẵng", region: "Miền Trung" },
    "Hà Nội": { slug: "ha-noi", name: "Hà Nội", region: "Miền Bắc" },
  };
export async function liveExploreCatalogue(
  signal?: AbortSignal,
): Promise<ProvinceDetail[]> {
  const routes = await apiJson(
    "/api/v1/explore/routes",
    z.array(z.object({ origin: z.string(), destination: z.string() })),
    { auth: false, signal },
  );
  const results = await Promise.all(
    routes.map(async (route) => {
      const params = new URLSearchParams({
        ...route,
        departureDate: nextCatalogueDate(),
        passengerCount: "1",
        page: "0",
        size: "100",
      });
      return (
        await apiJson(`/api/v1/trips?${params}`, pageOf(backendTripSchema), {
          auth: false,
          signal,
        })
      ).items;
    }),
  );
  const catalogue = new Map<
    string,
    {
      detail: ProvinceDetail;
      points: Map<string, ExplorePoint>;
      operators: Map<string, { id: string; name: string }>;
    }
  >();
  for (const trip of results.flat()) {
    for (const city of [trip.origin, trip.destination]) {
      const info = metadata[city];
      if (!info) continue;
      let group = catalogue.get(city);
      if (!group) {
        group = {
          detail: {
            ...info,
            description: `Khám phá hành trình và các điểm đón, trả tại ${info.name}.`,
            operatorCount: 0,
            pickupCount: 0,
            dropoffCount: 0,
            isMock: false,
            operators: [],
            points: [],
          },
          points: new Map(),
          operators: new Map(),
        };
        catalogue.set(city, group);
      }
      group.operators.set(trip.organizationId, {
        id: trip.organizationId,
        name: trip.operatorName,
      });
      for (const stop of trip.stops.filter((stop) => stop.name === city)) {
        const key = stop.id;
        const point = group.points.get(key) ?? {
          id: key,
          name: stop.name,
          address: stop.address || stop.name,
          services: [],
          operatorIds: [],
          latitude: null,
          longitude: null,
          coordinateSource: null,
        };
        if (stop.pickupAllowed && !point.services.includes("pickup"))
          point.services.push("pickup");
        if (stop.dropoffAllowed && !point.services.includes("dropoff"))
          point.services.push("dropoff");
        if (!point.operatorIds.includes(trip.organizationId))
          point.operatorIds.push(trip.organizationId);
        group.points.set(key, point);
      }
    }
  }
  return [...catalogue.values()].map(({ detail, points, operators }) => ({
    ...detail,
    points: [...points.values()],
    operators: [...operators.values()],
    operatorCount: operators.size,
    pickupCount: [...points.values()].filter((point) =>
      point.services.includes("pickup"),
    ).length,
    dropoffCount: [...points.values()].filter((point) =>
      point.services.includes("dropoff"),
    ).length,
  }));
}
