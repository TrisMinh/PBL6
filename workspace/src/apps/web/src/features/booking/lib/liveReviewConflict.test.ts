import { expect, it, vi } from "vitest";
vi.mock("@/shared/api/config", () => ({ isMockApi: false }));
import { createMockDb } from "@/mocks/state/mockDb";
import { canReviewBooking } from "./bookingReview";
import { canContinueBooking } from "./canContinueBooking";
import { getSelectedPassengerSeats } from "./passengerDraft";
import type { BookingDraft } from "../types/booking";
import type { SeatLayout } from "../types/seat";

it.each(["held", "sold"] as const)(
  "preserves a valid live review when another customer makes a seat %s",
  (status) => {
    const db = createMockDb();
    const trip = db.trips[0];
    const source = db.seats.get(trip.id);
    if (!source) throw new Error("Missing seats");
    const selected = source.slice(0, 2);
    const layout: SeatLayout = {
      tripId: trip.id,
      trip,
      vehicleType: trip.vehicleType,
      items: source.map((seat) => ({
        ...seat,
        status: seat.id === selected[1].id ? status : "available",
      })),
    };
    const draft: BookingDraft = {
      sessionId: "review",
      tripId: trip.id,
      passengerCount: 2,
      selectedSeatIds: selected.map((seat) => seat.id),
      totalVnd: trip.fareVnd * 2,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      contact: {
        fullName: "Nguyễn Minh Anh",
        phone: "0901234101",
        email: "minh.anh@bluebus.test",
      },
      passengers: selected.map((seat) => ({
        seatId: seat.id,
        fullName: "Nguyễn Minh Anh",
      })),
    };
    const countdown = { remainingSeconds: 600, isExpired: false };
    expect(canReviewBooking(draft, layout)).toBe(true);
    expect(canContinueBooking(draft, layout, countdown, false, false)).toBe(
      true,
    );
    expect(canContinueBooking(draft, layout, countdown)).toBe(false);
    expect(getSelectedPassengerSeats(draft, layout)).toBeNull();
    expect(canReviewBooking({ ...draft, totalVnd: 1 }, layout)).toBe(false);
    expect(canReviewBooking({ ...draft, contact: undefined }, layout)).toBe(
      false,
    );
    expect(
      canReviewBooking(
        { ...draft, selectedSeatIds: ["foreign", selected[1].id] },
        layout,
      ),
    ).toBe(false);
  },
);
