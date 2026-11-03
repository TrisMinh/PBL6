export interface Location {
  destinationIds?: readonly string[];
  id: string;
  name: string;
  displayName: string;
  province: string;
}

export interface OperatorSummary {
  id: string;
  name: string;
}

export type VehicleType = "sleeper-34" | "cabin-22";
export type TripAmenity = "wifi" | "charging" | "restroom" | "doorPickup";

export interface Trip {
  sellable?: boolean;
  status?: string;
  seatCountIsCapacity?: boolean;
  policyVersion?: string | null;
  allowPayLater?: boolean;
  stops?: readonly {
    id: string;
    name: string;
    address?: string | null;
    sequence: number;
    offsetMinutes: number;
    pickupAllowed: boolean;
    dropoffAllowed: boolean;
  }[];
  id: string;
  origin: Location;
  destination: Location;
  operator: OperatorSummary;
  displayOperatorName: string;
  departureTime: string;
  arrivalTime: string;
  fareVnd: number;
  availableSeatCount: number;
  vehicleType: VehicleType;
  vehicleLabel: string;
  originStopName: string;
  destinationStopName: string;
  amenities: readonly TripAmenity[];
}

export interface TripSearch {
  originId: string;
  destinationId: string;
  departureDate: string;
  passengerCount: number;
  sort:
    | "relevance"
    | "departure"
    | "price-asc"
    | "price-desc"
    | "duration-asc"
    | "duration-desc";
}

export interface TripSearchInput extends TripSearch {
  filters?: {
    organizationId?: string;
    pickupStopId?: string;
    dropoffStopId?: string;
    minFare?: number;
    maxFare?: number;
    departureHour?: string;
    amenities?: readonly TripAmenity[];
  };
}
