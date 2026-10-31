import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/shared/api/config", () => ({ isMockApi: false, apiBaseUrl: "" }));
import { backendBookingRepository } from "./backendBookingRepository";
import { saveApiSession } from "@/shared/api/session";
import { useBookingDraftStore } from "../store/bookingDraftStore";
import { getSelectedPassengerSeats } from "../lib/passengerDraft";

const ids = {
  user: "019a3a71-0000-7000-8000-000000000001",
  trip: "019a3a71-0000-7000-8000-000000000002",
  seat: "019a3a71-0000-7000-8000-000000000003",
  pickup: "019a3a71-0000-7000-8000-000000000004",
  dropoff: "019a3a71-0000-7000-8000-000000000005",
  booking: "019a3a71-0000-7000-8000-000000000006",
};
const trip = {
  id: ids.trip,
  organizationId: ids.user,
  operatorName: "Nhà xe",
  busType: "SLEEPER",
  amenities: [],
  departureAt: "2027-01-02T08:00:00+07:00",
  arrivalAt: "2027-01-02T12:00:00+07:00",
  origin: "Hồ Chí Minh",
  destination: "Đà Lạt",
  fare: { amount: 200000, currency: "VND" },
  status: "SCHEDULED",
  sellable: true,
  availableSeatCount: 1,
  availabilityAsOf: "2027-01-01T00:00:00Z",
  rowVersion: 0,
  stops: [
    {
      id: ids.pickup,
      name: "Bến đi",
      sequence: 0,
      offsetMinutes: 0,
      pickupAllowed: true,
      dropoffAllowed: false,
    },
    {
      id: ids.dropoff,
      name: "Bến đến",
      sequence: 1,
      offsetMinutes: 240,
      pickupAllowed: false,
      dropoffAllowed: true,
    },
  ], // Nullable fields are omitted by ASP.NET's WhenWritingNull serializer.
};
const seat = {
  id: ids.seat,
  code: "A1",
  type: "SLEEPER",
  status: "AVAILABLE",
  price: trip.fare,
  rowVersion: 0,
};
beforeEach(() => {
  sessionStorage.clear();
  useBookingDraftStore.getState().clearDraft();
  saveApiSession({
    accessToken: "header.payload.signature",
    refreshToken: "refresh",
    tokenType: "Bearer",
    expiresIn: 3600,
    sessionId: ids.user,
    user: { id: ids.user, roles: ["CUSTOMER"] },
  });
});
it("adapts real inventory, drafts selections locally, then holds and creates using stable retry keys", async () => {
  const calls: { path: string; init?: RequestInit }[] = [];
  let failBooking = true;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input);
    calls.push({ path, init });
    if (path.endsWith("/seats"))
      return Response.json({ tripId: ids.trip, seats: [seat] });
    if (path.endsWith("/seat-holds") || path.includes("/seat-holds/"))
      return Response.json(
        {
          holdToken: "real-hold-token",
          tripId: ids.trip,
          status: "ACTIVE",
          seats: [seat],
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          serverTime: new Date().toISOString(),
        },
        { status: path.endsWith("/seat-holds") ? 201 : 200 },
      );
    if (path.endsWith("/bookings")) {
      if (failBooking) {
        failBooking = false;
        throw new TypeError("response lost");
      }
      return Response.json(
        {
          id: ids.booking,
          code: "BK123456",
          customerId: ids.user,
          tripId: ids.trip,
          status: "PENDING_PAYMENT",
          paymentChannel: "PREPAID",
          total: 200000,
          currency: "VND",
          rowVersion: 0,
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          contact: {
            fullName: "Khách",
            email: "a@example.com",
            phone: "0901234567",
          },
          items: [
            {
              seatId: ids.seat,
              fullName: "Khách",
              pickupStopId: ids.pickup,
              dropoffStopId: ids.dropoff,
            },
          ],
        },
        { status: 201 },
      );
    }
    return Response.json(trip);
  });
  const session = await backendBookingRepository.createSession(ids.trip, 1);
  useBookingDraftStore.getState().setDraft(session);
  const selected = await backendBookingRepository.replaceSeats(
    session.sessionId,
    [ids.seat],
  );
  useBookingDraftStore.getState().setDraft(selected);
  const layout = await backendBookingRepository.getSeats(ids.trip);
  expect(getSelectedPassengerSeats(selected, layout)).toEqual([
    { id: ids.seat, code: "A1" },
  ]);
  expect(calls.some((c) => c.init?.method === "POST")).toBe(false);
  const passengers = await backendBookingRepository.replacePassengers(
    session.sessionId,
    { fullName: "Khách", email: "a@example.com", phone: "0901234567" },
    [{ seatId: ids.seat, fullName: "Khách" }],
  );
  useBookingDraftStore.getState().setDraft(passengers);
  await expect(
    backendBookingRepository.createBooking(session.sessionId, "same-attempt"),
  ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  const booking = await backendBookingRepository.createBooking(
    session.sessionId,
    "same-attempt",
  );
  expect(booking.bookingCode).toBe("BK123456");
  expect(calls.filter((c) => c.path.endsWith("/seat-holds"))).toHaveLength(1);
  const creates = calls.filter((c) => c.path.endsWith("/bookings"));
  expect(creates).toHaveLength(2);
  expect(creates[0].init?.body).toBe(creates[1].init?.body);
  expect(new Headers(creates[0].init?.headers).get("Idempotency-Key")).toBe(
    new Headers(creates[1].init?.headers).get("Idempotency-Key"),
  );
  expect(JSON.parse(String(creates[0].init?.body))).toMatchObject({
    holdToken: "real-hold-token",
    expectedTotal: 200000,
    paymentChannel: "PREPAID",
  });
});
it("rejects stale booking drafts after switching accounts", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(trip));
  const draft = await backendBookingRepository.createSession(ids.trip, 1);
  useBookingDraftStore.getState().setDraft(draft);
  saveApiSession({
    accessToken: "other.jwt.token",
    refreshToken: "other-refresh",
    tokenType: "Bearer",
    expiresIn: 3600,
    sessionId: ids.booking,
    user: { id: ids.booking, roles: ["CUSTOMER"] },
  });
  await expect(
    backendBookingRepository.replaceSeats(draft.sessionId, [ids.seat]),
  ).rejects.toMatchObject({ code: "ACCESS_REQUIRED" });
});
