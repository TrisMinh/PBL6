import { afterEach, beforeEach, expect, it } from "vitest";

import { createBookingHandlers } from "@/mocks/handlers/bookingHandlers";
import { createOrderHandlers } from "@/mocks/handlers/createBookingHandlers";
import { createMockDb, type MockDb } from "@/mocks/state/mockDb";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { server } from "@/mocks/server";
import { createReadyBookingSession } from "@/test/booking";

let db: MockDb;
let now = Date.now();
beforeEach(() => {
  now = Date.now();
  db = createMockDb();
  server.use(
    ...createBookingHandlers({ db, now: () => now }),
    ...createOrderHandlers({
      db,
      now: () => now,
      createBookingId: () => "booking-one",
    }),
  );
});
afterEach(() => db.reset());
async function post(
  sessionId: string,
  key = "attempt-one",
  body: unknown = { sessionId },
): Promise<Response> {
  return fetch("/api/v1/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}
it("creates one immutable pending-payment booking and replays exact summary across retries", async () => {
  const session = await createReadyBookingSession();
  const before = structuredClone(session);
  const responses = await Promise.all([
    post(session.sessionId),
    post(session.sessionId),
    post(session.sessionId, "attempt-two"),
  ]);
  expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
  const summaries = await Promise.all(responses.map((r) => r.json()));
  expect(summaries[0]).toEqual({
    bookingId: "booking-one",
    bookingCode: expect.stringMatching(/^BLUE-[A-Z0-9-]+$/),
    sessionId: session.sessionId,
    totalVnd: 640000,
    status: "pending-payment",
  });
  expect(summaries[1]).toEqual(summaries[0]);
  expect(summaries[2]).toEqual(summaries[0]);
  expect(db.bookings.size).toBe(1);
  expect(Object.isFrozen(db.bookings.get("booking-one"))).toBe(true);
  expect(db.sessions.get(session.sessionId)).toMatchObject({
    ...before,
    bookingId: "booking-one",
    bookingAttemptKey: "attempt-one",
  });
});
it.each([
  "missing-key",
  "invalid-key",
  "body-extra",
  "missing-session",
  "incomplete",
  "total",
  "seat-owner",
  "expired",
  "key-other-session",
])("fails closed with sanitized Problem Details for %s", async (mode) => {
  const session = await createReadyBookingSession();
  let id = session.sessionId;
  let key = "attempt-one";
  let body: unknown = { sessionId: id };
  if (mode === "missing-key") key = "";
  if (mode === "invalid-key") key = "PRIVATE VALUE";
  if (mode === "body-extra") body = { sessionId: id, email: "PRIVATE_PAYLOAD" };
  if (mode === "missing-session") {
    id = "PRIVATE_PAYLOAD";
    body = { sessionId: id };
  }
  const state = db.sessions.get(id);
  if (!state && mode !== "missing-session") throw new Error("Expected session");
  if (state && mode === "incomplete") state.contact = undefined;
  if (state && mode === "total") state.totalVnd++;
  if (state && mode === "seat-owner")
    db.holds.set(state.selectedSeatIds[0], "other");
  if (mode === "expired") now = Date.parse(session.expiresAt);
  if (mode === "key-other-session") {
    await post(id);
    const other = await httpBookingRepository.createSession(
      "trip-hcm-dalat-early",
      2,
    );
    id = other.sessionId;
    body = { sessionId: id };
  }
  const response = await post(id, key, body);
  const expected =
    mode === "expired"
      ? 410
      : mode === "missing-session"
        ? 404
        : mode === "key-other-session"
          ? 409
          : 400;
  expect(response.status).toBe(expected);
  expect(response.headers.get("content-type")).toContain(
    "application/problem+json",
  );
  const problem = await response.json();
  expect(problem).toMatchObject({
    status: expected,
    instance: "/api/v1/bookings",
    traceId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  });
  expect(JSON.stringify(problem)).not.toMatch(
    /PRIVATE|0912345678|test\+review/,
  );
  expect(db.bookings.size).toBe(mode === "key-other-session" ? 1 : 0);
});
it.each(["seats", "passengers"])(
  "locks %s edits after booking and preserves original immutable booking and hold",
  async (endpoint) => {
    const session = await createReadyBookingSession();
    await post(session.sessionId);
    const before = structuredClone(db.sessions.get(session.sessionId));
    const body =
      endpoint === "seats"
        ? { seatIds: [] }
        : { contact: session.contact, passengers: session.passengers };
    const response = await fetch(
      `/api/v1/booking-sessions/${session.sessionId}/${endpoint}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "BOOKING_LOCKED" });
    expect(db.sessions.get(session.sessionId)).toEqual(before);
    expect(db.bookings.get("booking-one")?.totalVnd).toBe(640000);
    expect(db.holds.size).toBe(2);
  },
);
