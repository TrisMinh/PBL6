import { apiFetch as fetch } from "@/shared/api/client";
import { isMockApi } from "@/shared/api/config";
import { backendTripRepository } from "./backendTripRepository";
import type { z } from "zod";

import type { TripRepository } from "@/features/trips/repositories/tripRepository";
import { TripRepositoryError } from "@/features/trips/repositories/tripRepositoryError";
import {
  locationsResponseSchema,
  tripSearchResponseSchema,
} from "@/features/trips/schemas/tripResponse.schema";

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { signal });
  } catch {
    throw new TripRepositoryError(
      signal?.aborted ? "ABORTED" : "NETWORK_ERROR",
    );
  }
  if (!response.ok)
    throw new TripRepositoryError("HTTP_ERROR", response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new TripRepositoryError(
      signal?.aborted ? "ABORTED" : "INVALID_RESPONSE",
      signal?.aborted ? 0 : response.status,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new TripRepositoryError("INVALID_RESPONSE", response.status);
  return parsed.data;
}

const mockRepository: TripRepository = {
  getLocations: async (signal) =>
    (await request("/api/v1/locations", locationsResponseSchema, signal)).items,
  search: async (input, signal) => {
    const params = new URLSearchParams({
      originId: input.originId,
      destinationId: input.destinationId,
      departureDate: input.departureDate,
      passengerCount: String(input.passengerCount),
      sort: input.sort,
    });
    return (
      await request(`/api/v1/trips?${params}`, tripSearchResponseSchema, signal)
    ).items;
  },
};

export const httpTripRepository = isMockApi
  ? mockRepository
  : backendTripRepository;
