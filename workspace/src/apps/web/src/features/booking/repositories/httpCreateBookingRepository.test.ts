import { http, HttpResponse } from "msw";
import { afterEach, expect, it } from "vitest";

import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { createReadyBookingSession } from "@/test/booking";

afterEach(() => mockDb.reset());
it("posts only session identity and required key, parses/freeze summary and supports abort", async () => {
  const session = await createReadyBookingSession();
  let body: unknown;
  let key: string | null = null;
  server.use(
    http.post("/api/v1/bookings", async ({ request }) => {
      body = await request.clone().json();
      key = request.headers.get("Idempotency-Key");
      return undefined;
    }),
  );
  const booking = await httpBookingRepository.createBooking(
    session.sessionId,
    "stable-key",
  );
  expect(body).toEqual({ sessionId: session.sessionId });
  expect(key).toBe("stable-key");
  expect(booking).toMatchObject({
    sessionId: session.sessionId,
    totalVnd: 640000,
    status: "pending-payment",
  });
  expect(Object.isFrozen(booking)).toBe(true);
  const controller = new AbortController();
  controller.abort();
  await expect(
    httpBookingRepository.createBooking(
      session.sessionId,
      "stable-key",
      controller.signal,
    ),
  ).rejects.toMatchObject({ code: "ABORTED" });
});
it.each([
  "wrong-session",
  "zero",
  "fraction",
  "status",
  "code",
  "malformed",
  "wrong-status",
  "non-json",
  "problem",
])("rejects %s without exposing raw response", async (mode) => {
  const session = await createReadyBookingSession();
  const response: Record<string, unknown> = {
    bookingId: "booking-test",
    bookingCode: "BLUE-TEST",
    sessionId: session.sessionId,
    totalVnd: 560000,
    status: "pending-payment",
  };
  if (mode === "wrong-session") response.sessionId = "other";
  if (mode === "zero") response.totalVnd = 0;
  if (mode === "fraction") response.totalVnd = 0.5;
  if (mode === "status") response.status = "paid";
  if (mode === "code") response.bookingCode = "PRIVATE_PAYLOAD";
  if (mode === "malformed") response.bookingId = null;
  server.use(
    http.post("/api/v1/bookings", () =>
      mode === "non-json"
        ? new HttpResponse("PRIVATE_PAYLOAD", { status: 201 })
        : mode === "problem"
          ? HttpResponse.json(
              { code: "BOOKING_LOCKED", detail: "PRIVATE_PAYLOAD" },
              { status: 409 },
            )
          : HttpResponse.json(response, {
              status: mode === "wrong-status" ? 200 : 201,
            }),
    ),
  );
  const error = await httpBookingRepository
    .createBooking(session.sessionId, "stable-key")
    .catch((error: unknown) => error);
  expect(error).toMatchObject({
    code: mode === "problem" ? "BOOKING_LOCKED" : "INVALID_RESPONSE",
  });
  expect(String(error)).not.toContain("PRIVATE_PAYLOAD");
});
it("rejects invalid request key before network", async () => {
  const session = await createReadyBookingSession();
  await expect(
    httpBookingRepository.createBooking(session.sessionId, " "),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
});
