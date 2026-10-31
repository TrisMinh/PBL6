import type {
  Location,
  Trip,
  TripSearchInput,
} from "@/features/trips/types/trip";

export interface TripRepository {
  getLocations(signal?: AbortSignal): Promise<readonly Location[]>;
  search(
    input: TripSearchInput,
    signal?: AbortSignal,
  ): Promise<readonly Trip[]>;
}
