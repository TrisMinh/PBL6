import type { Trip, VehicleType } from "@/features/trips/types/trip";

export type SeatStatus = "available" | "held" | "sold" | "disabled";

export interface Seat {
  id: string;
  code: string;
  deck: "lower" | "upper";
  row: number;
  column: number;
  status: SeatStatus;
}

export interface SeatLayout {
  tripId: string;
  vehicleType: VehicleType;
  trip: Trip;
  items: readonly Seat[];
}
