import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { server } from "@/mocks/server";
import { mockDb } from "@/mocks/state/mockDb";

const TRIP = "trip-hcm-dalat-early";
function session(): Record<string, unknown> {
  return {
    passengerCount: 2,
    sessionId: "session-safe",
    tripId: TRIP,
    selectedSeatIds: [],
    passengers: [],
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    totalVnd: 0,
    status: "active",
  };
}
beforeEach(() => mockDb.reset());

describe("httpBookingRepository over MSW", () => {
  it("POSTs only tripId and a UUID key, parses the real 201 session", async () => {
    let body: unknown;
    let key: string | null = null;
    server.use(
      http.post("/api/v1/booking-sessions", async ({ request }) => {
        body = await request.json();
        key = request.headers.get("Idempotency-Key");
        return HttpResponse.json(session(), { status: 201 });
      }),
    );
    const result = httpBookingRepository.createSession(TRIP, 2);
    await expect(result).resolves.toMatchObject({
      tripId: TRIP,
      sessionId: "session-safe",
      status: "active",
    });
    expect(body).toEqual({ passengerCount: 2, tripId: TRIP });
    expect(key).toMatch(/^[\da-f-]{36}$/);
  });
  it("forwards a caller attempt key unchanged and accepts replay selection", async () => {
    const options = { idempotencyKey: "stable-attempt" };
    const first = await httpBookingRepository.createSession(TRIP, 2, options);
    const selectedId = mockDb.seats
      .get(TRIP)
      ?.find((seat) => seat.status === "available")?.id;
    expect(selectedId).toBeDefined();
    const selected = await fetch(
      `/api/v1/booking-sessions/${first.sessionId}/seats`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds: [selectedId] }),
      },
    );
    expect(selected.status).toBe(200);
    const again = await httpBookingRepository.createSession(TRIP, 2, options);
    expect(again).toMatchObject({
      sessionId: first.sessionId,
      expiresAt: first.expiresAt,
      selectedSeatIds: [selectedId],
    });
    expect(again.totalVnd).toBe(320_000);
    expect(mockDb.sessions.size).toBe(1);
  });
  it.each([
    { sessionId: "" },
    { passengerCount: 2, tripId: "other-trip" },
    { selectedSeatIds: ["a", "a"] },
    { selectedSeatIds: ["1", "2", "3", "4", "5", "6", "7"] },
    { passengers: [{ seatId: "unknown", fullName: "Private" }] },
    { totalVnd: 1 },
    { selectedSeatIds: ["seat-a"], totalVnd: 0 },
    { totalVnd: -1 },
    { totalVnd: 1.5 },
    { expiresAt: "not-a-date" },
    { expiresAt: "2020-01-01T00:00:00Z" },
    { expiresAt: "2099-01-01T00:00:00+07:00" },
    { status: "expired" },
    { contact: { email: 1 } },
  ])("rejects schema drift %j as a safe typed error", async (patch) => {
    server.use(
      http.post("/api/v1/booking-sessions", () =>
        HttpResponse.json({ ...session(), ...patch }, { status: 201 }),
      ),
    );
    await expect(
      httpBookingRepository.createSession(TRIP, 2),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 201 });
  });
  it.each([200, 400, 409, 410, 503])(
    "normalizes unexpected HTTP %i without exposing Problem Details",
    async (status) => {
      server.use(
        http.post("/api/v1/booking-sessions", () =>
          HttpResponse.json({ detail: "PRIVATE_SERVER" }, { status }),
        ),
      );
      try {
        await httpBookingRepository.createSession(TRIP, 2);
        throw new Error("Expected rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(BookingRepositoryError);
        expect(error).toMatchObject({
          code: status === 200 ? "INVALID_RESPONSE" : "HTTP_ERROR",
          status,
        });
        expect(String(error)).not.toContain("PRIVATE_SERVER");
      }
    },
  );
  it("rejects malformed JSON and transport failures safely", async () => {
    server.use(
      http.post(
        "/api/v1/booking-sessions",
        () => new HttpResponse("PRIVATE_JSON", { status: 201 }),
      ),
    );
    await expect(
      httpBookingRepository.createSession(TRIP, 2),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    server.use(
      http.post("/api/v1/booking-sessions", () => HttpResponse.error()),
    );
    await expect(
      httpBookingRepository.createSession(TRIP, 2),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR", canRetry: true });
  });
  it("forwards AbortSignal and normalizes cancellation", async () => {
    const received = vi.fn();
    server.use(
      http.post("/api/v1/booking-sessions", async ({ request }) => {
        received(request.signal);
        await delay(100);
        return HttpResponse.json(session(), { status: 201 });
      }),
    );
    const controller = new AbortController();
    const request = httpBookingRepository
      .createSession(TRIP, 2, { signal: controller.signal })
      .catch((error: unknown) => error);

    await vi.waitFor(() => expect(received).toHaveBeenCalled());
    controller.abort();
    expect(await request).toMatchObject({
      code: "ABORTED",
      status: 0,
      canRetry: false,
    });
    expect(received.mock.calls[0]?.[0].aborted).toBe(true);
  });
});
