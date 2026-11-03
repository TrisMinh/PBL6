import { isMockApi } from "@/shared/api/config";
import type { QueryClient } from "@tanstack/react-query";

import type { Seat } from "@/features/booking/types/seat";
import { bookingKeys } from "@/features/booking/api/bookingQueryKeys";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import type {
  BookingDraft,
  BookingSession,
} from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";

export interface SeatMutationVariables {
  previous: BookingDraft;
  layout: SeatLayout;
  seatIds: string[];
  controller: AbortController;
}
export interface SeatMutationSnapshot {
  layout: SeatLayout | undefined;
}
function sameSession(previous: BookingDraft): boolean {
  return (
    useBookingDraftStore.getState().draft?.sessionId === previous.sessionId
  );
}
export function optimisticLayout(
  layout: SeatLayout,
  previous: readonly string[],
  next: readonly string[],
): SeatLayout {
  const items = layout.items.map((seat): Seat =>
    next.includes(seat.id)
      ? { ...seat, status: isMockApi ? "held" : seat.status }
      : isMockApi && previous.includes(seat.id) && seat.status === "held"
        ? { ...seat, status: "available" }
        : seat,
  );
  return {
    ...layout,
    trip: {
      ...layout.trip,
      availableSeatCount: items.filter((seat) => seat.status === "available")
        .length,
    },
    items,
  };
}
export async function beginSeatMutation(
  client: QueryClient,
  variables: SeatMutationVariables,
): Promise<SeatMutationSnapshot> {
  const key = bookingKeys.seats(variables.previous.tripId);
  await client.cancelQueries({ queryKey: key, exact: true });
  if (!sameSession(variables.previous))
    throw new BookingRepositoryError("ABORTED");
  const previousLayout = client.getQueryData<SeatLayout>(key);
  client.setQueryData(
    key,
    optimisticLayout(
      variables.layout,
      variables.previous.selectedSeatIds,
      variables.seatIds,
    ),
  );
  useBookingDraftStore.getState().setDraft({
    ...variables.previous,
    selectedSeatIds: [...variables.seatIds],
    totalVnd: variables.layout.trip.fareVnd * variables.seatIds.length,
    passengers: variables.previous.passengers.filter((passenger) =>
      variables.seatIds.includes(passenger.seatId),
    ),
  });
  return { layout: previousLayout };
}
export async function executeSeatMutation(
  variables: SeatMutationVariables,
): Promise<BookingSession> {
  const session = await httpBookingRepository.replaceSeats(
    variables.previous.sessionId,
    variables.seatIds,
    variables.controller.signal,
  );
  if (
    session.tripId !== variables.previous.tripId ||
    session.passengerCount !== variables.previous.passengerCount ||
    session.expiresAt !== variables.previous.expiresAt ||
    (isMockApi &&
      session.totalVnd !==
        variables.layout.trip.fareVnd * variables.seatIds.length)
  )
    throw new BookingRepositoryError("INVALID_RESPONSE", 200);
  return session;
}
export function commitSeatMutation(
  client: QueryClient,
  session: BookingSession,
  variables: SeatMutationVariables,
  alive: boolean,
): void {
  if (!alive || !sameSession(variables.previous)) return;
  useBookingDraftStore.getState().setDraft(session);
  client.setQueryData(
    bookingKeys.seats(session.tripId),
    optimisticLayout(
      variables.layout,
      variables.previous.selectedSeatIds,
      session.selectedSeatIds,
    ),
  );
  void client.invalidateQueries({
    queryKey: bookingKeys.seats(session.tripId),
    exact: true,
  });
}
export async function rollbackSeatMutation(
  client: QueryClient,
  error: BookingRepositoryError,
  variables: SeatMutationVariables,
  snapshot: SeatMutationSnapshot | undefined,
): Promise<void> {
  const key = bookingKeys.seats(variables.previous.tripId);
  if (!sameSession(variables.previous)) {
    await client.invalidateQueries({ queryKey: key, exact: true });
    return;
  }
  useBookingDraftStore.getState().setDraft(variables.previous);
  if (snapshot?.layout) client.setQueryData(key, snapshot.layout);
  else client.removeQueries({ queryKey: key, exact: true });
  if (error.code === "SEAT_CONFLICT")
    await client.refetchQueries({ queryKey: key, exact: true, type: "all" });
}
