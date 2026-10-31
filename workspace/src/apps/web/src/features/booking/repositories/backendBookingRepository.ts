import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import {
  backendSeatSchema,
  bookingSchema,
  holdSchema,
} from "@/shared/api/contracts";
import { bookingAction } from "@/shared/api/bookingError";
import { readApiSession } from "@/shared/api/session";
import { ApiError } from "@/shared/api/error";
import {
  getBackendTrip,
  toTrip,
} from "@/features/trips/repositories/backendTripRepository";
import { useBookingDraftStore } from "../store/bookingDraftStore";
import type { BookingRepository } from "./bookingRepository";
import type { BookingSession } from "../types/booking";
import type { SeatLayout, SeatStatus } from "../types/seat";

const metadataSchema = z.object({
  owner: z.string(),
  pickupStopId: z.string().uuid().optional(),
  dropoffStopId: z.string().uuid().optional(),
  paymentChannel: z.enum(["PREPAID", "PAY_LATER"]).optional(),
  attempt: z.string().optional(),
  holdRequest: z
    .object({
      seatIds: z.array(z.string()),
      pickupStopId: z.string(),
      dropoffStopId: z.string(),
    })
    .optional(),
  holdToken: z.string().optional(),
  bookingId: z.string().optional(),
});
export const keyFor = (id: string): string => `blue-live-booking:${id}`;
function owner(): string {
  const session = readApiSession();
  if (!session)
    throw new ApiError(
      "AUTHENTICATION_REQUIRED",
      401,
      "Vui lòng đăng nhập để đặt vé.",
    );
  return session.user.id;
}
function draftFor(id: string): BookingSession {
  const draft = useBookingDraftStore.getState().draft;
  const meta = metadataSchema.safeParse(
    JSON.parse(sessionStorage.getItem(keyFor(id)) ?? "null"),
  );
  if (
    !draft ||
    draft.sessionId !== id ||
    !meta.success ||
    meta.data.owner !== owner()
  )
    throw new ApiError(
      "AUTHENTICATION_REQUIRED",
      401,
      "Phiên đặt vé không thuộc tài khoản hiện tại.",
    );
  if (Date.parse(draft.expiresAt) <= Date.now())
    throw new ApiError("HOLD_EXPIRED", 410, "Phiên đặt vé đã hết hạn.");
  return { ...draft, status: "active" };
}
export async function getLiveSeatLayout(
  tripId: string,
  signal?: AbortSignal,
): Promise<SeatLayout> {
  const [trip, inventory] = await Promise.all([
    getBackendTrip(tripId, signal),
    apiJson(
      `/api/v1/trips/${encodeURIComponent(tripId)}/seats`,
      z.object({ tripId: z.string(), seats: z.array(backendSeatSchema) }),
      { signal },
    ),
  ]);
  const counters = { lower: 0, upper: 0 };
  const view = toTrip(trip);
  return {
    tripId,
    trip: view,
    vehicleType: view.vehicleType,
    // The public inventory has no physical coordinates. Display an ordered selection grid.
    items: inventory.seats.map((seat) => {
      const deck = /^B/i.test(seat.code)
        ? ("upper" as const)
        : ("lower" as const);
      const index = counters[deck]++;
      const status = seat.status.toLowerCase();
      return {
        id: seat.id,
        code: seat.code,
        deck,
        row: Math.floor(index / 3),
        column: index % 3,
        status: (["available", "held", "sold", "disabled"].includes(status)
          ? status
          : "disabled") as SeatStatus,
      };
    }),
  };
}
export const backendBookingRepository: BookingRepository = {
  createSession: (tripId, passengerCount, options = {}) =>
    bookingAction(async () => {
      const user = owner();
      await getBackendTrip(tripId, options.signal);
      const sessionId = crypto.randomUUID();
      sessionStorage.setItem(
        keyFor(sessionId),
        JSON.stringify({ owner: user }),
      );
      return {
        sessionId,
        tripId,
        passengerCount,
        selectedSeatIds: [],
        passengers: [],
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        totalVnd: 0,
        status: "active",
      };
    }),
  getSeats: (tripId, signal) =>
    bookingAction(() => getLiveSeatLayout(tripId, signal)),
  replaceSeats: (id, seatIds, signal) =>
    bookingAction(async () => {
      const draft = draftFor(id);
      if (
        draft.bookingId ||
        JSON.parse(sessionStorage.getItem(keyFor(id)) ?? "{}").attempt
      )
        throw new ApiError("BOOKING_LOCKED", 409, "Đơn đã được tạo.");
      const [layout, trip] = await Promise.all([
        getLiveSeatLayout(draft.tripId, signal),
        getBackendTrip(draft.tripId, signal),
      ]);
      if (seatIds.length > 6 || new Set(seatIds).size !== seatIds.length)
        throw new ApiError(
          "VALIDATION_ERROR",
          400,
          "Lựa chọn ghế không hợp lệ.",
        );
      if (
        seatIds.some(
          (id) =>
            !layout.items.some(
              (seat) => seat.id === id && seat.status === "available",
            ),
        )
      )
        throw new ApiError(
          "SEAT_CONFLICT",
          409,
          "Ghế vừa được người khác chọn. Vui lòng chọn lại.",
        );
      return {
        ...draft,
        selectedSeatIds: [...seatIds],
        totalVnd: trip.fare.amount * seatIds.length,
        passengers: draft.passengers.filter((passenger) =>
          seatIds.includes(passenger.seatId),
        ),
      };
    }),
  replacePassengers: (id, contact, passengers) =>
    bookingAction(async () => {
      const draft = draftFor(id);
      if (
        draft.bookingId ||
        JSON.parse(sessionStorage.getItem(keyFor(id)) ?? "{}").attempt
      )
        throw new ApiError("BOOKING_LOCKED", 409, "Đơn đã được tạo.");
      return { ...draft, contact, passengers: [...passengers] };
    }),
  createBooking: (id, attempt, signal) =>
    bookingAction(async () => {
      const draft = draftFor(id);
      if (
        !draft.contact ||
        !draft.passengers.length ||
        draft.passengers.length !== draft.selectedSeatIds.length
      )
        throw new ApiError(
          "VALIDATION_ERROR",
          400,
          "Vui lòng nhập đủ thông tin hành khách.",
        );
      const meta = metadataSchema.parse(
        JSON.parse(sessionStorage.getItem(keyFor(id)) ?? "null"),
      );
      const trip = await getBackendTrip(draft.tripId, signal);
      const pickup = meta.pickupStopId
        ? trip.stops.find(
            (stop) => stop.id === meta.pickupStopId && stop.pickupAllowed,
          )
        : trip.stops.find((stop) => stop.pickupAllowed);
      const dropoff = meta.dropoffStopId
        ? trip.stops.find(
            (stop) => stop.id === meta.dropoffStopId && stop.dropoffAllowed,
          )
        : [...trip.stops].reverse().find((stop) => stop.dropoffAllowed);
      if (!pickup || !dropoff || pickup.sequence >= dropoff.sequence)
        throw new ApiError(
          "VALIDATION_ERROR",
          400,
          "Chuyến chưa có điểm đón/trả hợp lệ.",
        );
      if (meta.paymentChannel === "PAY_LATER" && !trip.allowPayLater)
        throw new ApiError(
          "PAY_LATER_NOT_ALLOWED",
          409,
          "Chuyến này không cho phép thanh toán sau.",
        );
      const holdRequest = meta.holdRequest ?? {
        seatIds: draft.selectedSeatIds,
        pickupStopId: pickup.id,
        dropoffStopId: dropoff.id,
      };
      sessionStorage.setItem(
        keyFor(id),
        JSON.stringify({ ...meta, attempt, holdRequest }),
      );
      // Retry the SAME hold and booking requests after an ambiguous network failure.
      const hold = meta.holdToken
        ? await apiJson(
            `/api/v1/seat-holds/${encodeURIComponent(meta.holdToken)}`,
            holdSchema,
            { signal },
          )
        : await apiJson(
            `/api/v1/trips/${draft.tripId}/seat-holds`,
            holdSchema,
            {
              method: "POST",
              signal,
              idempotencyKey: `web-hold-${attempt}`,
              body: holdRequest,
            },
          );
      sessionStorage.setItem(
        keyFor(id),
        JSON.stringify({
          ...meta,
          attempt,
          holdRequest,
          holdToken: hold.holdToken,
        }),
      );
      const booking = await apiJson("/api/v1/bookings", bookingSchema, {
        method: "POST",
        signal,
        idempotencyKey: `web-booking-${attempt}`,
        body: {
          holdToken: hold.holdToken,
          contact: draft.contact,
          passengers: draft.passengers.map((p) => ({
            seatId: p.seatId,
            fullName: p.fullName,
            documentType: null,
            documentNumber: null,
            pickupStopId: pickup.id,
            dropoffStopId: dropoff.id,
          })),
          expectedTotal: draft.totalVnd,
          currency: "VND",
          paymentChannel: meta.paymentChannel ?? "PREPAID",
        },
      });
      sessionStorage.setItem(
        keyFor(id),
        JSON.stringify({
          ...meta,
          holdToken: hold.holdToken,
          bookingId: booking.id,
          attempt,
        }),
      );
      return {
        bookingId: booking.id,
        bookingCode: booking.code,
        sessionId: id,
        totalVnd: booking.total,
        status:
          meta.paymentChannel === "PAY_LATER" ? "confirmed" : "pending-payment",
      };
    }),
};
