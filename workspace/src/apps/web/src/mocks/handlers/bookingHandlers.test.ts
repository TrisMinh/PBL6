import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { SeatStatus } from "@/features/booking/types/seat";
import { trips } from "@/mocks/fixtures/trips";
import { createBookingHandlers } from "@/mocks/handlers/bookingHandlers";
import { server } from "@/mocks/server";
import { createMockDb, mockDb, type MockDb } from "@/mocks/state/mockDb";

const TRIP_ID = "trip-hcm-dalat-early";
const BASE_TIME = Date.parse("2026-10-20T00:00:00Z");
const passengerSchema = z.object({
  seatId: z.string(),
  fullName: z.string(),
  phone: z.string().optional(),
});
const contactSchema = z.object({
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
});
const sessionSchema = z.object({
  passengerCount: z.number().int().min(1).max(6),
  sessionId: z.string().min(1),
  tripId: z.string(),
  selectedSeatIds: z.array(z.string()),
  passengers: z.array(passengerSchema),
  contact: contactSchema.optional(),
  expiresAt: z.iso.datetime(),
  totalVnd: z.number().int().nonnegative(),
  status: z.enum(["active", "expired", "completed"]),
});
const seatSchema = z.object({
  id: z.string(),
  code: z.string(),
  deck: z.enum(["lower", "upper"]),
  row: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  status: z.enum(["available", "held", "sold", "disabled"]),
});
const problemSchema = z.object({
  type: z.literal("about:blank"),
  title: z.string().min(1),
  status: z.number(),
  detail: z.string().min(1),
  instance: z.string(),
  code: z.string(),
  traceId: z.uuid(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
  conflictingSeatIds: z.array(z.string()).optional(),
});
let db: MockDb;
let nowMs: number;

beforeEach(() => {
  db = createMockDb();
  nowMs = BASE_TIME;
  let count = 0;
  server.use(
    ...createBookingHandlers({
      db,
      now: () => nowMs,
      createSessionId: () => `test-session-${++count}`,
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  mockDb.reset();
});

async function send(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(new URL(path, window.location.origin), {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function createSession(
  tripId = TRIP_ID,
  headers: Record<string, string> = {},
): Promise<z.infer<typeof sessionSchema>> {
  const response = await send(
    "POST",
    "/api/v1/booking-sessions",
    { passengerCount: 2, tripId },
    headers,
  );
  expect(response.status).toBe(201);
  return sessionSchema.parse(await response.json());
}

function snapshot(): unknown {
  return structuredClone({
    trips: db.trips,
    seats: [...db.seats],
    sessions: [...db.sessions],
    holds: [...db.holds],
    keys: [...db.sessionKeys],
  });
}

function availableIds(count: number, tripId = TRIP_ID): string[] {
  const ids = (db.seats.get(tripId) ?? [])
    .filter((seat) => seat.status === "available")
    .slice(0, count)
    .map((seat) => seat.id);
  expect(ids).toHaveLength(count);
  return ids;
}

function seatId(status: SeatStatus): string {
  const seat = db.seats.get(TRIP_ID)?.find((seat) => seat.status === status);
  if (!seat) throw new Error(`Missing fixture ${status}`);
  return seat.id;
}

async function expectProblem(
  response: Response,
  status: number,
  code: string,
): Promise<z.infer<typeof problemSchema>> {
  expect(response.status).toBe(status);
  expect(response.headers.get("Content-Type")).toContain(
    "application/problem+json",
  );
  const problem = problemSchema.parse(await response.json());
  expect(problem.status).toBe(status);
  expect(problem.code).toBe(code);
  expect(problem.instance).not.toContain("?");
  return problem;
}

describe("booking session HTTP handlers", () => {
  it.each(["trip", "layout"])(
    "PUT fails closed if the session %s reference is absent",
    async (reference) => {
      const session = await createSession();
      if (reference === "trip") db.trips.splice(0);
      else db.seats.delete(TRIP_ID);
      const before = snapshot();
      await expectProblem(
        await send(
          "PUT",
          `/api/v1/booking-sessions/${session.sessionId}/seats`,
          { seatIds: [] },
        ),
        404,
        "NOT_FOUND",
      );
      expect(snapshot()).toEqual(before);
    },
  );

  it("PUT passengers accepts only structural draft strings and exact selected-seat correspondence", async () => {
    const session = await createSession();
    const ids = availableIds(2);
    expect(
      (
        await send(
          "PUT",
          `/api/v1/booking-sessions/${session.sessionId}/seats`,
          { seatIds: ids },
        )
      ).status,
    ).toBe(200);
    const contact = {
      fullName: "",
      email: "not-an-email",
      phone: "draft-phone",
    };
    const passengers = ids.map((seatId) => ({
      seatId,
      fullName: "",
      phone: "draft-phone",
    }));
    const response = await send(
      "PUT",
      `/api/v1/booking-sessions/${session.sessionId}/passengers`,
      { contact, passengers },
    );
    expect(response.status).toBe(200);
    expect(sessionSchema.parse(await response.json())).toEqual({
      ...session,
      selectedSeatIds: ids,
      totalVnd: 640_000,
      contact,
      passengers,
    });
    const changed = await send(
      "PUT",
      `/api/v1/booking-sessions/${session.sessionId}/seats`,
      { seatIds: ids.slice(1) },
    );
    expect(changed.status).toBe(200);
    expect(sessionSchema.parse(await changed.json())).toMatchObject({
      contact,
      passengers: passengers.slice(1),
      totalVnd: 320_000,
    });
  });

  it.each([
    "missing name",
    "wrong phone type",
    "duplicate",
    "mismatched",
    "missing contact",
    "extra field",
  ])(
    "passenger %s validation leaves state unchanged and does not echo PII",
    async (mode) => {
      const session = await createSession();
      const ids = availableIds(2);
      expect(
        (
          await send(
            "PUT",
            `/api/v1/booking-sessions/${session.sessionId}/seats`,
            { seatIds: ids },
          )
        ).status,
      ).toBe(200);
      const contact = {
        fullName: "PRIVATE_NAME",
        email: "PRIVATE_EMAIL",
        phone: "PRIVATE_PHONE",
      };
      const passengers = ids.map((seatId) => ({
        seatId,
        fullName: "PRIVATE_NAME",
      }));
      let body: unknown = { contact, passengers };
      if (mode === "missing name")
        body = { contact, passengers: ids.map((seatId) => ({ seatId })) };
      if (mode === "wrong phone type")
        body = { contact: { ...contact, phone: 5 }, passengers };
      if (mode === "duplicate")
        body = { contact, passengers: [passengers[0], passengers[0]] };
      if (mode === "mismatched")
        body = {
          contact,
          passengers: [
            { seatId: "PRIVATE_SEAT", fullName: "PRIVATE_NAME" },
            passengers[1],
          ],
        };
      if (mode === "missing contact") body = { passengers };
      if (mode === "extra field") body = { contact, passengers, totalVnd: 1 };
      const before = snapshot();
      const problem = await expectProblem(
        await send(
          "PUT",
          `/api/v1/booking-sessions/${session.sessionId}/passengers`,
          body,
        ),
        400,
        "VALIDATION_ERROR",
      );
      expect(JSON.stringify(problem)).not.toMatch(
        /PRIVATE_NAME|PRIVATE_EMAIL|PRIVATE_PHONE|PRIVATE_SEAT/,
      );
      expect(snapshot()).toEqual(before);
    },
  );

  it("passenger requests require an active known session and permit an empty draft correspondence", async () => {
    const contact = { fullName: "", email: "", phone: "" };
    const body = { contact, passengers: [] };
    await expectProblem(
      await send(
        "PUT",
        "/api/v1/booking-sessions/PRIVATE_SESSION/passengers",
        body,
      ),
      404,
      "NOT_FOUND",
    );
    const session = await createSession();
    expect(
      (
        await send(
          "PUT",
          `/api/v1/booking-sessions/${session.sessionId}/passengers`,
          body,
        )
      ).status,
    ).toBe(200);
    nowMs += 600_000;
    await expectProblem(
      await send(
        "PUT",
        `/api/v1/booking-sessions/${session.sessionId}/passengers`,
        body,
      ),
      410,
      "HOLD_EXPIRED",
    );
  });

  it("POST idempotency mismatches and invalid header fail without mutation; concurrent identical keys replay", async () => {
    const [first, second] = await Promise.all([
      createSession(TRIP_ID, { "Idempotency-Key": "test-parallel" }),
      createSession(TRIP_ID, { "Idempotency-Key": "test-parallel" }),
    ]);
    expect(first).toEqual(second);
    expect(db.sessions.size).toBe(1);
    const before = snapshot();
    await expectProblem(
      await send(
        "POST",
        "/api/v1/booking-sessions",
        { passengerCount: 2, tripId: "trip-hcm-dalat-cabin" },
        { "Idempotency-Key": "test-parallel" },
      ),
      400,
      "VALIDATION_ERROR",
    );
    await expectProblem(
      await send(
        "POST",
        "/api/v1/booking-sessions",
        { passengerCount: 2, tripId: TRIP_ID },
        { "Idempotency-Key": "PRIVATE @invalid" },
      ),
      400,
      "VALIDATION_ERROR",
    );
    expect(snapshot()).toEqual(before);
  });

  it("reset removes session/key/hold state and restores immutable seeds for the next network request", async () => {
    const fixtureBefore = JSON.stringify(trips);
    const session = await createSession(TRIP_ID, {
      "Idempotency-Key": "test-reset",
    });
    expect(
      (
        await send(
          "PUT",
          `/api/v1/booking-sessions/${session.sessionId}/seats`,
          { seatIds: availableIds(2) },
        )
      ).status,
    ).toBe(200);
    db.reset();
    expect(db.sessions.size).toBe(0);
    expect(db.holds.size).toBe(0);
    expect(db.sessionKeys.size).toBe(0);
    expect(db.trips).toEqual(trips);
    await expectProblem(
      await send("PUT", `/api/v1/booking-sessions/${session.sessionId}/seats`, {
        seatIds: [],
      }),
      404,
      "NOT_FOUND",
    );
    const next = await createSession(TRIP_ID, {
      "Idempotency-Key": "test-reset",
    });
    expect(next.sessionId).not.toBe(session.sessionId);
    expect(JSON.stringify(trips)).toBe(fixtureBefore);
  });

  it("default booking handlers are registered centrally with a real UTC clock", async () => {
    server.resetHandlers();
    mockDb.reset();
    const before = Date.now();
    const response = await send("POST", "/api/v1/booking-sessions", {
      passengerCount: 2,
      tripId: TRIP_ID,
    });
    expect(response.status).toBe(201);
    const session = sessionSchema.parse(await response.json());
    expect(z.uuid().safeParse(session.sessionId).success).toBe(true);
    expect(Date.parse(session.expiresAt)).toBeGreaterThanOrEqual(
      before + 600_000,
    );
    expect(Date.parse(session.expiresAt)).toBeLessThanOrEqual(
      Date.now() + 600_000,
    );
  });

  it("booking scenario query controls cannot override production state", async () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", false);
    expect(
      (
        await send("POST", "/api/v1/booking-sessions?scenario=error", {
          passengerCount: 2,
          tripId: TRIP_ID,
        })
      ).status,
    ).toBe(201);
    expect(
      (await send("GET", `/api/v1/trips/${TRIP_ID}/seats?scenario=empty`))
        .status,
    ).toBe(200);
    expect(db.sessions.size).toBe(1);
  });
  it("PUT seats replaces atomically, retains own holds, releases removed seats and clears selection", async () => {
    const session = await createSession();
    const ids = availableIds(3);
    const first = await send(
      "PUT",
      `/api/v1/booking-sessions/${session.sessionId}/seats`,
      { seatIds: ids.slice(0, 2) },
    );
    expect(first.status).toBe(200);
    expect(sessionSchema.parse(await first.json())).toEqual({
      ...session,
      selectedSeatIds: ids.slice(0, 2),
      totalVnd: 640_000,
    });
    expect(ids.slice(0, 2).map((id) => db.holds.get(id))).toEqual([
      session.sessionId,
      session.sessionId,
    ]);
    nowMs += 60_000;
    const same = await send(
      "PUT",
      `/api/v1/booking-sessions/${session.sessionId}/seats`,
      { seatIds: ids.slice(0, 2) },
    );
    expect(same.status).toBe(200);
    expect(sessionSchema.parse(await same.json()).expiresAt).toBe(
      session.expiresAt,
    );
    const replacement = await send(
      "PUT",
      `/api/v1/booking-sessions/${session.sessionId}/seats`,
      { seatIds: [ids[1], ids[2]] },
    );
    expect(replacement.status).toBe(200);
    expect(db.holds.has(ids[0] ?? "")).toBe(false);
    expect(
      db.seats.get(TRIP_ID)?.find((seat) => seat.id === ids[0])?.status,
    ).toBe("available");
    const cleared = await send(
      "PUT",
      `/api/v1/booking-sessions/${session.sessionId}/seats`,
      { seatIds: [] },
    );
    expect(cleared.status).toBe(200);
    expect(sessionSchema.parse(await cleared.json())).toMatchObject({
      selectedSeatIds: [],
      totalVnd: 0,
      expiresAt: session.expiresAt,
    });
    expect(db.holds.size).toBe(0);
  });

  it("accepts six seats and rejects seven without modifying any DB state", async () => {
    const tripId = "trip-hcm-dalat-cabin";
    const session = await createSession(tripId);
    const ids = availableIds(7, tripId);
    const accepted = await send(
      "PUT",
      `/api/v1/booking-sessions/${session.sessionId}/seats`,
      { seatIds: ids.slice(0, 6) },
    );
    expect(accepted.status).toBe(200);
    expect(sessionSchema.parse(await accepted.json()).totalVnd).toBe(
      6 * 280_000,
    );
    const before = snapshot();
    await expectProblem(
      await send("PUT", `/api/v1/booking-sessions/${session.sessionId}/seats`, {
        seatIds: ids,
      }),
      409,
      "SELECTION_LIMIT_EXCEEDED",
    );
    expect(snapshot()).toEqual(before);
  });

  it.each(["sold", "held", "disabled"] as const)(
    "%s seat conflict retains previous session, seats and total atomically",
    async (status) => {
      const session = await createSession();
      const ids = availableIds(2);
      const unavailable = seatId(status);
      expect(
        (
          await send(
            "PUT",
            `/api/v1/booking-sessions/${session.sessionId}/seats`,
            { seatIds: [ids[0]] },
          )
        ).status,
      ).toBe(200);
      const before = snapshot();
      const result = await expectProblem(
        await send(
          "PUT",
          `/api/v1/booking-sessions/${session.sessionId}/seats`,
          { seatIds: [ids[1], unavailable] },
        ),
        409,
        "SEAT_CONFLICT",
      );
      expect(result.conflictingSeatIds).toEqual([unavailable]);
      expect(snapshot()).toEqual(before);
    },
  );

  it.each(["PRIVATE_PERSON@invalid", "trip-hcm-dalat-cabin:A01"])(
    "unknown or other-trip seat %s is never echoed",
    async (unknown) => {
      const session = await createSession();
      const before = snapshot();
      const result = await expectProblem(
        await send(
          "PUT",
          `/api/v1/booking-sessions/${session.sessionId}/seats`,
          { seatIds: [...availableIds(1), unknown] },
        ),
        409,
        "SEAT_CONFLICT",
      );
      expect(result.conflictingSeatIds).toEqual([]);
      expect(JSON.stringify(result)).not.toContain(unknown);
      expect(snapshot()).toEqual(before);
    },
  );

  it("duplicate canonical IDs fail validation without mutation", async () => {
    const session = await createSession();
    const id = availableIds(1)[0];
    const before = snapshot();
    const result = await expectProblem(
      await send("PUT", `/api/v1/booking-sessions/${session.sessionId}/seats`, {
        seatIds: [id, ` ${id} `],
      }),
      400,
      "VALIDATION_ERROR",
    );
    expect(result.errors).toHaveProperty("seatIds");
    expect(snapshot()).toEqual(before);
  });

  it("another active session cannot steal a held seat", async () => {
    const first = await createSession();
    const second = await createSession();
    const ids = availableIds(1);
    expect(
      (
        await send("PUT", `/api/v1/booking-sessions/${first.sessionId}/seats`, {
          seatIds: ids,
        })
      ).status,
    ).toBe(200);
    const before = snapshot();
    await expectProblem(
      await send("PUT", `/api/v1/booking-sessions/${second.sessionId}/seats`, {
        seatIds: ids,
      }),
      409,
      "SEAT_CONFLICT",
    );
    expect(snapshot()).toEqual(before);
  });

  it("concurrent competing selections have one winner and one unchanged losing session", async () => {
    const first = await createSession();
    const second = await createSession();
    const ids = availableIds(1);
    const responses = await Promise.all(
      [first, second].map((session) =>
        send("PUT", `/api/v1/booking-sessions/${session.sessionId}/seats`, {
          seatIds: ids,
        }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      [...db.sessions.values()]
        .map((session) => session.selectedSeatIds.length)
        .sort(),
    ).toEqual([0, 1]);
    expect(db.holds.size).toBe(1);
  });

  it("expiry at the exact boundary releases owned holds and rejects renewal by PUT or idempotency replay", async () => {
    const session = await createSession(TRIP_ID, {
      "Idempotency-Key": "test-expiry",
    });
    const ids = availableIds(1);
    expect(
      (
        await send(
          "PUT",
          `/api/v1/booking-sessions/${session.sessionId}/seats`,
          { seatIds: ids },
        )
      ).status,
    ).toBe(200);
    nowMs = BASE_TIME + 600_000;
    await expectProblem(
      await send("PUT", `/api/v1/booking-sessions/${session.sessionId}/seats`, {
        seatIds: ids,
      }),
      410,
      "HOLD_EXPIRED",
    );
    expect(db.sessions.get(session.sessionId)?.status).toBe("expired");
    expect(db.holds.size).toBe(0);
    expect(
      db.seats.get(TRIP_ID)?.find((seat) => seat.id === ids[0])?.status,
    ).toBe("available");
    await expectProblem(
      await send(
        "POST",
        "/api/v1/booking-sessions",
        { passengerCount: 2, tripId: TRIP_ID },
        { "Idempotency-Key": "test-expiry" },
      ),
      410,
      "HOLD_EXPIRED",
    );
    expect(db.sessions.size).toBe(1);
    expect(db.sessions.get(session.sessionId)?.expiresAt).toBe(
      session.expiresAt,
    );
  });

  it("expired other holds are reclaimed only on successful selection, never during conflict rollback", async () => {
    const expired = await createSession();
    const ids = availableIds(1);
    expect(
      (
        await send(
          "PUT",
          `/api/v1/booking-sessions/${expired.sessionId}/seats`,
          { seatIds: ids },
        )
      ).status,
    ).toBe(200);
    nowMs += 1000;
    const active = await createSession();
    nowMs = BASE_TIME + 600_000;
    const before = snapshot();
    const sold = seatId("sold");
    const problem = await expectProblem(
      await send("PUT", `/api/v1/booking-sessions/${active.sessionId}/seats`, {
        seatIds: [...ids, sold],
      }),
      409,
      "SEAT_CONFLICT",
    );
    expect(problem.conflictingSeatIds).toEqual([sold]);
    expect(snapshot()).toEqual(before);
    expect(
      (
        await send(
          "PUT",
          `/api/v1/booking-sessions/${active.sessionId}/seats`,
          { seatIds: ids },
        )
      ).status,
    ).toBe(200);
    expect(db.sessions.get(expired.sessionId)?.status).toBe("expired");
    expect(db.holds.get(ids[0] ?? "")).toBe(active.sessionId);
  });

  it("GET and successful POST release expired session holds", async () => {
    const first = await createSession();
    const ids = availableIds(1);
    expect(
      (
        await send("PUT", `/api/v1/booking-sessions/${first.sessionId}/seats`, {
          seatIds: ids,
        })
      ).status,
    ).toBe(200);
    nowMs += 600_000;
    expect((await send("GET", `/api/v1/trips/${TRIP_ID}/seats`)).status).toBe(
      200,
    );
    expect(db.holds.size).toBe(0);
    expect(db.sessions.get(first.sessionId)?.status).toBe("expired");
    const second = await createSession();
    expect(
      (
        await send(
          "PUT",
          `/api/v1/booking-sessions/${second.sessionId}/seats`,
          { seatIds: ids },
        )
      ).status,
    ).toBe(200);
    nowMs += 600_000;
    await createSession();
    expect(db.holds.size).toBe(0);
    expect(db.sessions.get(second.sessionId)?.status).toBe("expired");
  });

  it.each([
    {},
    null,
    { seatIds: "wrong" },
    { seatIds: [1] },
    { seatIds: [""] },
    { seatIds: [], totalVnd: 1 },
  ])("PUT seats rejects invalid structure %j", async (body) => {
    const session = await createSession();
    const before = snapshot();
    await expectProblem(
      await send(
        "PUT",
        `/api/v1/booking-sessions/${session.sessionId}/seats`,
        body,
      ),
      400,
      "VALIDATION_ERROR",
    );
    expect(snapshot()).toEqual(before);
  });

  it("missing session returns a static 404 without leaking route IDs", async () => {
    const result = await expectProblem(
      await send(
        "PUT",
        "/api/v1/booking-sessions/PRIVATE_SESSION/seats?secret=PRIVATE_QUERY",
        { seatIds: [] },
      ),
      404,
      "NOT_FOUND",
    );
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_SESSION|PRIVATE_QUERY/);
  });
  it.each([
    [TRIP_ID, "cabin-22", 22],
    ["trip-hcm-dalat-cabin", "sleeper-34", 34],
  ])(
    "GET seats returns %s layout and sanitized domain records",
    async (tripId, vehicleType, count) => {
      const response = await send("GET", `/api/v1/trips/${tripId}/seats`);
      expect(response.status).toBe(200);
      const body: unknown = await response.json();
      expect(body).toMatchObject({ tripId, vehicleType });
      const result = z
        .object({
          tripId: z.string(),
          vehicleType: z.string(),
          items: z.array(seatSchema),
        })
        .parse(body);
      expect(result).toEqual({
        tripId,
        vehicleType,
        items: db.seats.get(tripId),
      });
      expect(result.items).toHaveLength(Number(count));
    },
  );

  it("POST creates an active empty session exactly ten minutes from the injected clock", async () => {
    const session = await createSession();
    expect(session).toEqual({
      passengerCount: 2,
      sessionId: "test-session-1",
      tripId: TRIP_ID,
      selectedSeatIds: [],
      passengers: [],
      expiresAt: new Date(BASE_TIME + 600_000).toISOString(),
      totalVnd: 0,
      status: "active",
    });
    expect(db.sessions.get(session.sessionId)).toEqual(session);
    expect(db.holds.size).toBe(0);
    expect(trips[0]?.availableSeatCount).toBe(6);
  });

  it("POST provided idempotency keys replay the same session without renewing expiry", async () => {
    const first = await createSession(TRIP_ID, {
      "Idempotency-Key": "test-key",
    });
    nowMs += 1000;
    const again = await createSession(TRIP_ID, {
      "Idempotency-Key": "test-key",
    });
    expect(again).toEqual(first);
    expect(db.sessions.size).toBe(1);
    const independent = await createSession();
    expect(independent.sessionId).not.toBe(first.sessionId);
  });

  it.each([
    null,
    {},
    { passengerCount: 2, tripId: "" },
    { passengerCount: 2, tripId: 5 },
    { tripId: TRIP_ID, totalVnd: 1 },
  ])("POST rejects malformed body %j atomically", async (body) => {
    const before = snapshot();
    const response = await send("POST", "/api/v1/booking-sessions", body);
    await expectProblem(response, 400, "VALIDATION_ERROR");
    expect(snapshot()).toEqual(before);
  });

  it("missing trips return sanitized 404 for GET and POST", async () => {
    const before = snapshot();
    for (const response of [
      await send(
        "GET",
        "/api/v1/trips/PRIVATE_PERSON/seats?secret=PRIVATE_QUERY",
      ),
      await send("POST", "/api/v1/booking-sessions", {
        passengerCount: 2,
        tripId: "PRIVATE_PERSON",
      }),
    ]) {
      const problem = await expectProblem(response, 404, "NOT_FOUND");
      expect(JSON.stringify(problem)).not.toMatch(
        /PRIVATE_PERSON|PRIVATE_QUERY/,
      );
    }
    expect(snapshot()).toEqual(before);
  });

  it("POST malformed JSON is a safe validation problem without echoing input", async () => {
    const response = await fetch(
      new URL("/api/v1/booking-sessions", window.location.origin),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{PRIVATE_JSON",
      },
    );
    const problem = await expectProblem(response, 400, "VALIDATION_ERROR");
    expect(JSON.stringify(problem)).not.toContain("PRIVATE_JSON");
  });
});
