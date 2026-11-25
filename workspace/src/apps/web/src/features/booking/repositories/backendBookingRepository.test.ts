import { beforeEach, expect, it, vi } from "vitest";
vi.hoisted(() => vi.resetModules());
vi.mock("@/shared/api/config", () => ({ isMockApi: false, apiBaseUrl: "" }));
import {
  keyFor,
  backendBookingRepository,
  cancelSeatDraft,
} from "./backendBookingRepository";
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

it("clears the last seat without cancelling the session until explicitly requested", async () => {
  const expiresAt = new Date(Date.now() + 360_000).toISOString();
  const requests: string[] = [];
  const current = {
    holdToken: "resume-test",
    tripId: ids.trip,
    status: "ACTIVE",
    expiresAt,
    serverTime: new Date().toISOString(),
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = String(input);
    if (path.endsWith("/seat-holds/current"))
      return Response.json({ ...current, seats: [seat] });
    if (path.includes("/seat-holds/resume-test")) {
      requests.push(`${init?.method} ${path}`);
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      expect(JSON.parse(String(init?.body)).seatIds).toEqual([]);
      return Response.json({ ...current, seats: [] });
    }
    return Response.json(trip);
  });
  const session = await backendBookingRepository.createSession(ids.trip, 1);
  useBookingDraftStore.getState().setDraft(session);
  const empty = await backendBookingRepository.replaceSeats(
    session.sessionId,
    [],
  );
  expect(empty.selectedSeatIds).toEqual([]);
  expect(empty.expiresAt).toBe(expiresAt);
  expect(requests).toEqual(["PUT /api/v1/seat-holds/resume-test"]);
  useBookingDraftStore.getState().setDraft(empty);
  await cancelSeatDraft(session.sessionId);
  expect(requests.at(-1)).toBe(
    "DELETE /api/v1/seat-holds/resume-test?cancelSession=true",
  );
  expect(sessionStorage.getItem(keyFor(session.sessionId))).toBeNull();
});
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
it("blocks starting a draft after sales close without creating a hold", async () => {
  const request = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ ...trip, sellable: false }));
  await expect(
    backendBookingRepository.createSession(ids.trip, 1),
  ).rejects.toMatchObject({
    code: "TRIP_NOT_SELLABLE",
  });
  expect(request).toHaveBeenCalledTimes(1);
  expect(useBookingDraftStore.getState().draft).toBeNull();
});
it("presents BOOKED inventory as sold while preserving the other seat states", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    Response.json(
      String(input).endsWith("/seats")
        ? {
            tripId: ids.trip,
            seats: ["AVAILABLE", "HELD", "BOOKED", "DISABLED"].map(
              (status, i) => ({ ...seat, code: `A${i + 1}`, status }),
            ),
          }
        : trip,
    ),
  );
  const layout = await backendBookingRepository.getSeats(ids.trip);
  expect(layout.items.map((s) => s.status)).toEqual([
    "available",
    "held",
    "sold",
    "disabled",
  ]);
});
it.each([false, true])(
  "preserves stable retry requests with coupon=%s",
  async (withCoupon) => {
    const calls: { path: string; init?: RequestInit }[] = [];
    let failBooking = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const path = String(input);
      calls.push({ path, init });
      if (path.endsWith("/seats"))
        return Response.json({ tripId: ids.trip, seats: [seat] });
      if (path.endsWith("/seat-holds/current"))
        return new Response(null, { status: 204 });
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
            total: withCoupon ? 160000 : 200000,
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
    expect(
      calls.filter(
        (c) => c.path.endsWith("/seat-holds") && c.init?.method === "POST",
      ),
    ).toHaveLength(1);
    expect(Date.parse(selected.expiresAt)).toBeGreaterThan(Date.now());
    const passengers = await backendBookingRepository.replacePassengers(
      session.sessionId,
      { fullName: "Khách", email: "a@example.com", phone: "0901234567" },
      [{ seatId: ids.seat, fullName: "Khách" }],
    );
    useBookingDraftStore.getState().setDraft(passengers);
    if (withCoupon) {
      const meta = JSON.parse(
        sessionStorage.getItem(keyFor(session.sessionId)) ?? "{}",
      );
      sessionStorage.setItem(
        keyFor(session.sessionId),
        JSON.stringify({
          ...meta,
          coupon: {
            code: "BLUE20",
            subtotal: 200000,
            discount: 40000,
            total: 160000,
            currency: "VND",
            expiresAt: "2099-01-01T00:00:00Z",
          },
        }),
      );
    }
    await expect(
      backendBookingRepository.createBooking(session.sessionId, "same-attempt"),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    const booking = await backendBookingRepository.createBooking(
      session.sessionId,
      "same-attempt",
    );
    expect(booking.bookingCode).toBe("BK123456");
    expect(booking.totalVnd).toBe(withCoupon ? 160000 : 200000);
    expect(calls.filter((c) => c.path.endsWith("/seat-holds"))).toHaveLength(1);
    const creates = calls.filter((c) => c.path.endsWith("/bookings"));
    expect(creates).toHaveLength(2);
    expect(creates[0].init?.body).toBe(creates[1].init?.body);
    expect(new Headers(creates[0].init?.headers).get("Idempotency-Key")).toBe(
      new Headers(creates[1].init?.headers).get("Idempotency-Key"),
    );
    expect(JSON.parse(String(creates[0].init?.body))).toMatchObject({
      holdToken: "real-hold-token",
      expectedTotal: withCoupon ? 160000 : 200000,
      paymentChannel: "PREPAID",
    });
    expect(JSON.parse(String(creates[0].init?.body)).couponCode).toBe(
      withCoupon ? "BLUE20" : undefined,
    );
  },
);
it("rejects stale booking drafts after switching accounts", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/seat-holds/current")
      ? new Response(null, { status: 204 })
      : Response.json(trip),
  );
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

it("resumes the existing seats and original deadline using only the signed-in account", async () => {
  const expiresAt = new Date(Date.now() + 360_000).toISOString();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/seat-holds/current")
      ? Response.json({
          holdToken: "resume-test",
          tripId: ids.trip,
          status: "ACTIVE",
          seats: [seat],
          expiresAt,
          serverTime: new Date().toISOString(),
        })
      : Response.json(trip),
  );
  const draft = await backendBookingRepository.createSession(ids.trip, 4);
  expect(draft.selectedSeatIds).toEqual([ids.seat]);
  expect(draft.passengerCount).toBe(1);
  expect(draft.expiresAt).toBe(expiresAt);
  expect(
    JSON.parse(sessionStorage.getItem(keyFor(draft.sessionId)) ?? "{}")
      .holdToken,
  ).toBe("resume-test");
});
