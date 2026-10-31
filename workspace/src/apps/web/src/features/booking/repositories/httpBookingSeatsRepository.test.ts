import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { server } from "@/mocks/server";
import { mockDb } from "@/mocks/state/mockDb";

const TRIP = "trip-hcm-dalat-early";
beforeEach(() => mockDb.reset());
afterEach(() => mockDb.reset());

describe("booking seats repository over MSW", () => {
  it.each([
    [TRIP, 22],
    ["trip-hcm-dalat-cabin", 34],
  ])("parses canonical trip/fare and seats for%s", async (tripId, count) => {
    const layout = await httpBookingRepository.getSeats(String(tripId));
    expect(layout.tripId).toBe(tripId);
    expect(layout.trip.id).toBe(tripId);
    expect(layout.trip.fareVnd).toBeGreaterThan(0);
    expect(layout.items).toHaveLength(Number(count));
  });
  it("PUT sends only full seatIds and parses atomic selection/deselection without renewing expiry", async () => {
    const session = await httpBookingRepository.createSession(TRIP, 2);
    const layout = await httpBookingRepository.getSeats(TRIP);
    const ids = layout.items
      .filter((seat) => seat.status === "available")
      .slice(0, 2)
      .map((seat) => seat.id);
    const selected = await httpBookingRepository.replaceSeats(
      session.sessionId,
      ids,
    );
    expect(selected.selectedSeatIds).toEqual(ids);
    expect(selected.totalVnd).toBe(layout.trip.fareVnd * 2);
    expect(selected.expiresAt).toBe(session.expiresAt);
    expect(selected.passengerCount).toBe(2);
    const cleared = await httpBookingRepository.replaceSeats(
      session.sessionId,
      [],
    );
    expect(cleared.selectedSeatIds).toEqual([]);
    expect(cleared.totalVnd).toBe(0);
  });
  it("retains only matching stable conflict IDs, never raw Problem Details strings", async () => {
    const id = `${TRIP}:A01`;
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/seats", () =>
        HttpResponse.json(
          {
            code: "SEAT_CONFLICT",
            conflictingSeatIds: [id, "PRIVATE", `${TRIP}:A02`],
            detail: "PRIVATE_DETAIL",
          },
          { status: 409 },
        ),
      ),
    );
    await expect(
      httpBookingRepository.replaceSeats("session", [id]),
    ).rejects.toMatchObject({
      code: "SEAT_CONFLICT",
      conflictingSeatIds: [id],
    });
  });
  it.each([
    [410, "HOLD_EXPIRED"],
    [409, "SELECTION_LIMIT_EXCEEDED"],
    [404, "NOT_FOUND"],
    [400, "VALIDATION_ERROR"],
    [503, "HOLD_EXPIRED"],
  ])(
    "sanitizes %i business error%s against its approved HTTP status",
    async (status, code) => {
      server.use(
        http.put("/api/v1/booking-sessions/:sessionId/seats", () =>
          HttpResponse.json(
            { code, detail: "PRIVATE" },
            { status: Number(status) },
          ),
        ),
      );
      await expect(
        httpBookingRepository.replaceSeats("session", []),
      ).rejects.toMatchObject({
        code: status === 503 ? "HTTP_ERROR" : code,
        status,
      });
    },
  );
  it("rejects malformed layouts, wrong session and response seat selection before returning data", async () => {
    server.use(
      http.get("/api/v1/trips/:tripId/seats", () =>
        HttpResponse.json({ tripId: TRIP, items: [] }),
      ),
    );
    await expect(httpBookingRepository.getSeats(TRIP)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/seats", () =>
        HttpResponse.json({
          sessionId: "other",
          tripId: TRIP,
          passengerCount: 2,
          selectedSeatIds: [],
          passengers: [],
          totalVnd: 0,
          status: "active",
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        }),
      ),
    );
    await expect(
      httpBookingRepository.replaceSeats("session", []),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
