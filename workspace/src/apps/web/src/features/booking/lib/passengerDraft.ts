import { isMockApi } from "@/shared/api/config";
import type { PassengerFormValues } from "@/features/booking/schemas/passenger.schema";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { Seat, SeatLayout } from "@/features/booking/types/seat";

export function getSelectedPassengerSeats(
  draft: BookingDraft,
  layout: SeatLayout,
  requireAvailability = true,
): Pick<Seat, "id" | "code">[] | null {
  const ids = draft.selectedSeatIds;
  if (
    draft.tripId !== layout.tripId ||
    !Number.isInteger(draft.passengerCount) ||
    draft.passengerCount < 1 ||
    draft.passengerCount > 6 ||
    ids.length !== draft.passengerCount ||
    new Set(ids).size !== ids.length ||
    draft.totalVnd !== layout.trip.fareVnd * ids.length
  )
    return null;
  const seats: Pick<Seat, "id" | "code">[] = [];
  for (const id of ids) {
    const seat = layout.items.find((item) => item.id === id);
    if (
      !seat ||
      (requireAvailability &&
        (isMockApi ? seat.status !== "held" : seat.status !== "available"))
    )
      return null;
    seats.push({ id: seat.id, code: seat.code });
  }
  return seats;
}
export function getPassengerDefaults(
  draft: BookingDraft,
  seats: readonly Pick<Seat, "id" | "code">[],
  profile?: PassengerFormValues["contact"],
): PassengerFormValues {
  return {
    contact: draft.contact
      ? { ...draft.contact }
      : {
          fullName: profile?.fullName ?? "",
          email: profile?.email ?? "",
          phone: profile?.phone ?? "",
        },
    passengers: seats.map((seat, index) => {
      const saved = draft.passengers.find(
        (passenger) => passenger.seatId === seat.id,
      );
      return {
        seatId: seat.id,
        fullName:
          saved?.fullName ?? (index === 0 ? (profile?.fullName ?? "") : ""),
        phone: saved?.phone ?? (index === 0 ? (profile?.phone ?? "") : ""),
      };
    }),
  };
}
