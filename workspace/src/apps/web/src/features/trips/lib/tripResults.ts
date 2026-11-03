import type {
  Trip,
  TripAmenity,
  TripSearch,
} from "@/features/trips/types/trip";
import { tripSearchSchema } from "@/features/trips/schemas/search.schema";
import { tripSchema } from "@/features/trips/schemas/tripResponse.schema";

export function parseTripSearch(params: URLSearchParams): TripSearch | null {
  const fields = [
    "originId",
    "destinationId",
    "departureDate",
    "passengerCount",
    "sort",
  ];
  if (fields.some((key) => params.getAll(key).length > 1)) return null;
  const parsed = tripSearchSchema.safeParse(Object.fromEntries(params));
  return parsed.success ? parsed.data : null;
}

export function selectVisibleTrips(
  trips: readonly Trip[],
  sort: TripSearch["sort"],
  filters: TripFilterCriteria = {},
): Trip[] {
  const vehicle = tripSchema.shape.vehicleType.safeParse(filters.vehicleType);
  const visible = trips.filter(
    (trip) =>
      (!filters.organizationId ||
        trip.operator.id === filters.organizationId) &&
      (!filters.pickupStopId ||
        Boolean(
          trip.stops?.some(
            (stop) => stop.id === filters.pickupStopId && stop.pickupAllowed,
          ),
        )) &&
      (!filters.dropoffStopId ||
        Boolean(
          trip.stops?.some(
            (stop) => stop.id === filters.dropoffStopId && stop.dropoffAllowed,
          ),
        )) &&
      (!vehicle.success || trip.vehicleType === vehicle.data) &&
      matchesDeparturePeriod(trip, filters.departurePeriod) &&
      matchesDepartureHour(trip, filters.departureHour) &&
      (filters.minFare === undefined || trip.fareVnd >= filters.minFare) &&
      (filters.maxFare === undefined || trip.fareVnd <= filters.maxFare) &&
      (filters.amenities?.every((amenity) =>
        trip.amenities.includes(amenity),
      ) ??
        true),
  );
  return visible.sort((left, right) => {
    if (sort === "duration-asc" || sort === "duration-desc") {
      const duration = (trip: Trip): number =>
        Date.parse(trip.arrivalTime) - Date.parse(trip.departureTime);
      return (
        (duration(left) - duration(right)) * (sort === "duration-desc" ? -1 : 1)
      );
    }
    if (sort === "price-asc") return left.fareVnd - right.fareVnd;
    if (sort === "price-desc") return right.fareVnd - left.fareVnd;
    if (sort === "departure")
      return Date.parse(left.departureTime) - Date.parse(right.departureTime);
    return 0;
  });
}

export interface TripFilterCriteria {
  organizationId?: string;
  pickupStopId?: string;
  dropoffStopId?: string;
  vehicleType?: string;
  departurePeriod?: "morning" | "afternoon" | "evening";
  departureHour?: string;
  minFare?: number;
  maxFare?: number;
  amenities?: readonly TripAmenity[];
}

const VIETNAM_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function departureMinutes(trip: Trip): number {
  const parts = Object.fromEntries(
    VIETNAM_TIME.formatToParts(new Date(trip.departureTime)).map(
      ({ type, value }) => [type, value],
    ),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function matchesDeparturePeriod(
  trip: Trip,
  period: TripFilterCriteria["departurePeriod"],
): boolean {
  if (!period) return true;
  const minutes = departureMinutes(trip);
  if (period === "morning") return minutes >= 5 * 60 && minutes < 12 * 60;
  if (period === "afternoon") return minutes >= 12 * 60 && minutes < 18 * 60;
  return minutes >= 18 * 60 || minutes < 5 * 60;
}

function matchesDepartureHour(trip: Trip, threshold?: string): boolean {
  if (!threshold || !/^([01]\d|2[0-3]):[0-5]\d$/.test(threshold)) return true;
  const [hour, minute] = threshold.split(":").map(Number);
  return departureMinutes(trip) >= hour * 60 + minute;
}
