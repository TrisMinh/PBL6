import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { backendTripRepository } from "./backendTripRepository";
import { locationIdentity } from "../lib/locationIdentity";
import type { Trip } from "../types/trip";
export async function loadLiveTripCatalogue(
  date: string,
  passengerCount: number,
  signal?: AbortSignal,
): Promise<Trip[]> {
  const routes = await apiJson(
    "/api/v1/explore/routes",
    z.array(z.object({ origin: z.string(), destination: z.string() })),
    { auth: false, signal },
  );
  const results = await Promise.all(
    routes.map((r) =>
      backendTripRepository.search(
        {
          originId: locationIdentity(r.origin),
          destinationId: locationIdentity(r.destination),
          departureDate: date,
          passengerCount,
          sort: "departure",
        },
        signal,
      ),
    ),
  );
  return [...new Map(results.flat().map((t) => [t.id, t])).values()];
}
