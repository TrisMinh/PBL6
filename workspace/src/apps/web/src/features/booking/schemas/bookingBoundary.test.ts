import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";

import { bookingSessionSchema } from "@/features/booking/schemas/bookingSession.schema";
import { bookingPassengerCountSchema } from "@/features/booking/schemas/passengerCount.schema";
import { seatLayoutSchema } from "@/features/booking/schemas/seatLayout.schema";
import {
  BOOKING_DRAFT_STORAGE_KEY,
  createBookingDraftStore,
} from "@/features/booking/store/bookingDraftStore";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { bookingResultsPath } from "@/features/booking/lib/bookingRecovery";
import { createMockDb } from "@/mocks/state/mockDb";
import { createBookingHandlers } from "@/mocks/handlers/bookingHandlers";
import { server } from "@/mocks/server";

const TRIP = "trip-hcm-dalat-early";
beforeEach(() => server.use(...createBookingHandlers({ db: createMockDb() })));
afterEach(() => sessionStorage.clear());
describe("durable passenger count boundary", () => {
  it.each([undefined, 0, 7, 1.5, "2", null, NaN])(
    "fails closed across body, response and persistence for %s",
    async (passengerCount) => {
      expect(
        bookingPassengerCountSchema.safeParse(passengerCount).success,
      ).toBe(false);
      const response = await fetch("/api/v1/booking-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: TRIP, passengerCount }),
      });
      expect(response.status).toBe(400);
      const draft = {
        sessionId: "session",
        tripId: TRIP,
        passengerCount,
        selectedSeatIds: [],
        passengers: [],
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        totalVnd: 0,
        status: "active",
      };
      expect(bookingSessionSchema.safeParse(draft).success).toBe(false);
      sessionStorage.setItem(
        BOOKING_DRAFT_STORAGE_KEY,
        JSON.stringify({ state: { draft }, version: 0 }),
      );
      const store = createBookingDraftStore();
      await store.persist.rehydrate();
      expect(store.getState().draft).toBeNull();
      expect(sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY)).toBeNull();
    },
  );
  it("accepts bounds and rejects idempotency replay with a changed count", async () => {
    expect(bookingPassengerCountSchema.parse(1)).toBe(1);
    expect(bookingPassengerCountSchema.parse(6)).toBe(6);
    await httpBookingRepository.createSession(TRIP, 1, {
      idempotencyKey: "same",
    });
    await expect(
      httpBookingRepository.createSession(TRIP, 2, { idempotencyKey: "same" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });
});
describe("seat layout response contract", () => {
  it.each([
    "trip",
    "duplicate",
    "cell",
    "code",
    "geometry",
    "deck",
    "status",
    "fare",
  ])("rejects %s drift", async (mode) => {
    const layout = structuredClone(await httpBookingRepository.getSeats(TRIP));
    const first = layout.items[0];
    const second = layout.items[1];
    if (!first || !second) throw new Error("Missing seats");
    const changed =
      mode === "trip"
        ? { ...layout, tripId: "other" }
        : mode === "duplicate"
          ? { ...layout, items: [first, first, ...layout.items.slice(2)] }
          : mode === "cell"
            ? {
                ...layout,
                items: [
                  first,
                  { ...second, row: first.row, column: first.column },
                  ...layout.items.slice(2),
                ],
              }
            : mode === "code"
              ? {
                  ...layout,
                  items: [
                    { ...first, id: `${TRIP}:A99`, code: "A99" },
                    ...layout.items.slice(1),
                  ],
                }
              : mode === "geometry"
                ? {
                    ...layout,
                    items: [
                      { ...first, row: 5, column: 4 },
                      ...layout.items.slice(1),
                    ],
                  }
                : mode === "deck"
                  ? {
                      ...layout,
                      items: [
                        { ...first, deck: "upper" },
                        ...layout.items.slice(1),
                      ],
                    }
                  : mode === "status"
                    ? {
                        ...layout,
                        items: [
                          { ...first, status: "PRIVATE" },
                          ...layout.items.slice(1),
                        ],
                      }
                    : { ...layout, trip: { ...layout.trip, fareVnd: 0 } };
    expect(seatLayoutSchema.safeParse(changed).success).toBe(false);
  });
  it("derives recovery service date in Vietnam across UTC midnight", async () => {
    const layout = await httpBookingRepository.getSeats(TRIP);
    const path = bookingResultsPath(
      {
        ...layout,
        trip: { ...layout.trip, departureTime: "2098-12-31T19:00:00Z" },
      },
      2,
      true,
    );
    const url = new URL(path, "https://example.invalid");
    expect(url.searchParams.get("departureDate")).toBe("2099-01-01");
    expect(url.searchParams.get("reason")).toBe("expired");
    expect(url.searchParams.get("passengerCount")).toBe("2");
  });
  it.each(["get", "put"])("forwards abort signal for %s", async (method) => {
    let entered: () => void = () => undefined;
    let release: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const respond = async (): Promise<Response> => {
      entered();
      await held;
      return HttpResponse.json({});
    };
    server.use(
      method === "get"
        ? http.get("/api/v1/trips/:tripId/seats", respond)
        : http.put("/api/v1/booking-sessions/:sessionId/seats", respond),
    );
    const controller = new AbortController();
    const promise =
      method === "get"
        ? httpBookingRepository.getSeats(TRIP, controller.signal)
        : httpBookingRepository.replaceSeats("session", [], controller.signal);
    const rejection = expect(promise).rejects.toMatchObject({
      code: "ABORTED",
    });
    await started;
    controller.abort();
    release();
    await rejection;
  });
});
