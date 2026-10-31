import type { SeatLayout } from "@/features/booking/types/seat";
import { formatDateTime } from "@/shared/lib/formatDateTime";
import { ROUTES } from "@/shared/config/routes";

export function bookingResultsPath(
  layout: SeatLayout,
  passengerCount: number,
  expired = false,
): string {
  const params = new URLSearchParams({
    originId: layout.trip.origin.id,
    destinationId: layout.trip.destination.id,
    departureDate: formatDateTime(layout.trip.departureTime, "dd/MM/yyyy")
      .split("/")
      .reverse()
      .join("-"),
    passengerCount: String(passengerCount),
  });
  if (expired) params.set("reason", "expired");
  return `${ROUTES.trips}?${params}`;
}
