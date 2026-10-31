import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";

import type { BookingSession } from "@/features/booking/types/booking";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { server } from "@/mocks/server";
import { mockDb } from "@/mocks/state/mockDb";

const TRIP = "trip-hcm-dalat-early";
const CONTACT = {
  fullName: "Khách Liên Hệ",
  email: "test+mock@example.invalid",
  phone: "0912345678",
};
const PASSENGERS = [
  { seatId: `${TRIP}:A01`, fullName: "Khách Một", phone: "+84912345678" },
  { seatId: `${TRIP}:A02`, fullName: "Khách Hai" },
];
async function session(): Promise<BookingSession> {
  const created = await httpBookingRepository.createSession(TRIP, 2);
  return httpBookingRepository.replaceSeats(
    created.sessionId,
    PASSENGERS.map((p) => p.seatId),
  );
}
beforeEach(() => mockDb.reset());
afterEach(() => mockDb.reset());
describe("passenger repository over the MSW network boundary", () => {
  it("PUT sends only canonical contact/passengers and preserves the complete original session", async () => {
    const before = await session();
    let body: unknown;
    server.use(
      http.put(
        "/api/v1/booking-sessions/:sessionId/passengers",
        async ({ request }) => {
          body = await request.clone().json();
          return undefined;
        },
      ),
    );
    const saved = await httpBookingRepository.replacePassengers(
      before.sessionId,
      CONTACT,
      PASSENGERS,
    );
    expect(body).toEqual({ contact: CONTACT, passengers: PASSENGERS });
    expect(saved).toEqual({
      ...before,
      contact: CONTACT,
      passengers: PASSENGERS,
    });
  });
  it.each([
    "contact",
    "name",
    "phone",
    "seat",
    "missing",
    "duplicate",
    "session",
    "json",
  ])("rejects %s response drift without exposing raw data", async (mode) => {
    const before = await session();
    const valid = { ...before, contact: CONTACT, passengers: PASSENGERS };
    const response =
      mode === "contact"
        ? { ...valid, contact: { ...CONTACT, email: "other@example.invalid" } }
        : mode === "name"
          ? {
              ...valid,
              passengers: [
                { ...PASSENGERS[0], fullName: "Changed" },
                PASSENGERS[1],
              ],
            }
          : mode === "phone"
            ? {
                ...valid,
                passengers: [
                  { ...PASSENGERS[0], phone: "0312345678" },
                  PASSENGERS[1],
                ],
              }
            : mode === "seat"
              ? {
                  ...valid,
                  passengers: [
                    { ...PASSENGERS[0], seatId: "foreign" },
                    PASSENGERS[1],
                  ],
                }
              : mode === "missing"
                ? { ...valid, passengers: PASSENGERS.slice(0, 1) }
                : mode === "duplicate"
                  ? { ...valid, passengers: [PASSENGERS[0], PASSENGERS[0]] }
                  : mode === "session"
                    ? { ...valid, sessionId: "other" }
                    : null;
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/passengers", () =>
        mode === "json"
          ? new HttpResponse("PRIVATE", {
              headers: { "Content-Type": "application/json" },
            })
          : HttpResponse.json(response),
      ),
    );
    const failure = httpBookingRepository.replacePassengers(
      before.sessionId,
      CONTACT,
      PASSENGERS,
    );
    await expect(failure).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(failure).rejects.not.toHaveProperty("cause");
  });
  it("allows exact returned passenger values in another order", async () => {
    const before = await session();
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/passengers", () =>
        HttpResponse.json({
          ...before,
          contact: CONTACT,
          passengers: [...PASSENGERS].reverse(),
        }),
      ),
    );
    await expect(
      httpBookingRepository.replacePassengers(
        before.sessionId,
        CONTACT,
        PASSENGERS,
      ),
    ).resolves.toMatchObject({ contact: CONTACT });
  });
  it.each([
    [410, "HOLD_EXPIRED"],
    [400, "VALIDATION_ERROR"],
    [503, "SERVICE_UNAVAILABLE"],
  ])("returns only safe typed error for %s", async (status, code) => {
    const before = await session();
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/passengers", () =>
        HttpResponse.json(
          { code, detail: "PRIVATE_PAYLOAD" },
          { status: Number(status) },
        ),
      ),
    );
    const error = await httpBookingRepository
      .replacePassengers(before.sessionId, CONTACT, PASSENGERS)
      .catch((error: unknown) => error);
    expect(error).toMatchObject({
      code: status === 503 ? "HTTP_ERROR" : code,
      status,
    });
    expect(String(error)).not.toContain("PRIVATE_PAYLOAD");
  });
  it("forwards AbortSignal and classifies cancellation", async () => {
    const before = await session();
    let enter: () => void = () => undefined;
    let release: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.put("/api/v1/booking-sessions/:sessionId/passengers", async () => {
        enter();
        await held;
        return undefined;
      }),
    );
    const controller = new AbortController();
    const pending = httpBookingRepository.replacePassengers(
      before.sessionId,
      CONTACT,
      PASSENGERS,
      controller.signal,
    );
    const assertion = expect(pending).rejects.toMatchObject({
      code: "ABORTED",
    });
    await entered;
    controller.abort();
    release();
    await assertion;
  });
});
