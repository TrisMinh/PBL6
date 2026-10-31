import { afterEach, expect, it } from "vitest";

import {
  getPassengerDefaults,
  getSelectedPassengerSeats,
} from "@/features/booking/lib/passengerDraft";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import type { BookingDraft } from "@/features/booking/types/booking";
import type { SeatLayout } from "@/features/booking/types/seat";
import { mockDb } from "@/mocks/state/mockDb";

async function setup(): Promise<{ draft: BookingDraft; layout: SeatLayout }> {
  const created = await httpBookingRepository.createSession(
    "trip-hcm-dalat-early",
    2,
  );
  const draft = await httpBookingRepository.replaceSeats(created.sessionId, [
    `${created.tripId}:A01`,
    `${created.tripId}:A02`,
  ]);
  return {
    draft,
    layout: await httpBookingRepository.getSeats(created.tripId),
  };
}
afterEach(() => mockDb.reset());
it.each([
  "trip",
  "fractional-count",
  "count-bound",
  "duplicate",
  "total",
  "unheld",
])("rejects %s draft/layout drift before building rows", async (mode) => {
  const { draft, layout } = await setup();
  if (mode === "trip") draft.tripId = "foreign";
  if (mode === "fractional-count") draft.passengerCount = 1.5;
  if (mode === "count-bound") draft.passengerCount = 7;
  if (mode === "duplicate")
    draft.selectedSeatIds = [
      draft.selectedSeatIds[0],
      draft.selectedSeatIds[0],
    ];
  if (mode === "total") draft.totalVnd++;
  const data: SeatLayout =
    mode === "unheld"
      ? {
          ...layout,
          items: layout.items.map((seat) => ({ ...seat, status: "available" })),
        }
      : layout;
  expect(getSelectedPassengerSeats(draft, data)).toBeNull();
});
it("returns detached defaults by stable seat identity and ignores unrelated saved rows", async () => {
  const { draft, layout } = await setup();
  draft.contact = {
    fullName: "Khách Liên Hệ",
    email: "test+test+mock@example.invalid",
    phone: "0912345678",
  };
  draft.passengers = [
    { seatId: draft.selectedSeatIds[1], fullName: "Khách Hai" },
    { seatId: "foreign", fullName: "Không dùng" },
  ];
  const seats = getSelectedPassengerSeats(draft, layout);
  if (!seats) throw new Error("Expected selected seats");
  const values = getPassengerDefaults(draft, seats);
  expect(values.passengers).toEqual([
    { seatId: draft.selectedSeatIds[0], fullName: "", phone: "" },
    { seatId: draft.selectedSeatIds[1], fullName: "Khách Hai", phone: "" },
  ]);
  values.contact.fullName = "Đã sửa";
  expect(draft.contact.fullName).toBe("Khách Liên Hệ");
  expect(seats).toEqual(
    draft.selectedSeatIds.map((id, index) => ({ id, code: `A0${index + 1}` })),
  );
});
