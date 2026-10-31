import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { locations } from "@/mocks/fixtures/locations";
import { trips } from "@/mocks/fixtures/trips";
import { createTripHandlers } from "@/mocks/handlers/tripHandlers";
import { server } from "@/mocks/server";

afterEach(() => vi.unstubAllEnvs());

function searchUrl(overrides: Record<string, string> = {}): URL {
  const url = new URL("/api/v1/trips", window.location.origin);
  url.search = new URLSearchParams({
    originId: "loc-hcm",
    destinationId: "loc-dalat",
    departureDate: "2099-01-01",
    passengerCount: "2",
    ...overrides,
  }).toString();
  return url;
}

const resultSchema = z.object({
  items: z.array(z.object({ id: z.string() })),
  total: z.number().int(),
});
const problemSchema = z.object({
  type: z.literal("about:blank"),
  title: z.string().min(1),
  status: z.number(),
  detail: z.string().min(1),
  instance: z.literal("/api/v1/trips"),
  code: z.enum(["VALIDATION_ERROR", "SERVICE_UNAVAILABLE"]),
  traceId: z.uuid(),
  errors: z.record(z.string(), z.array(z.string().min(1))).optional(),
});

describe("trip discovery HTTP handlers", () => {
  it("GET locations returns the canonical fixture collection", async () => {
    const response = await fetch(
      new URL("/api/v1/locations", window.location.origin),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ items: locations });
  });

  it.each(["relevance", "departure", "price-asc", "price-desc"])(
    "filters Vietnam service date and sorts %s without mutating seeds",
    async (sort) => {
      const before = JSON.stringify(trips);
      const response = await fetch(searchUrl({ sort: String(sort) }));
      const body = resultSchema.parse(await response.json());
      expect(response.status).toBe(200);
      expect(body.total).toBe(24);
      expect(body.items).toHaveLength(24);
      expect(new Set(body.items.map((item) => item.id))).toHaveProperty(
        "size",
        24,
      );
      expect(JSON.stringify(trips)).toBe(before);
    },
  );

  it("defaults relevance sort and serializes the complete Trip payload", async () => {
    const response = await fetch(searchUrl());
    const body: unknown = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({
      items: trips.slice(0, 24),
      total: 24,
    });
  });

  it.each<[Record<string, string>, string[]]>([
    [{ departureDate: "2099-01-02" }, ["trip-hcm-dalat-next-day"]],
    [
      { originId: "loc-danang", destinationId: "loc-hanoi" },
      ["trip-danang-hanoi-day"],
    ],
    [{ originId: "loc-hanoi" }, []],
  ])(
    "separates routes and adjacent service days",
    async (query, expectedIds) => {
      const response = await fetch(searchUrl(query));
      const body = resultSchema.parse(await response.json());
      expect(response.status).toBe(200);
      expect(body.items.map((item) => item.id)).toEqual(expectedIds);
      expect(body.total).toBe(expectedIds.length);
    },
  );

  it.each(["relevance", "departure", "price-asc", "price-desc"])(
    "preserves source order on %s ties",
    async (sort) => {
      const source = Object.freeze([
        Object.freeze({
          ...trips[0],
          id: "tie-z",
          fareVnd: 300_000,
          departureTime: "2099-01-01T02:00:00Z",
        }),
        Object.freeze({
          ...trips[1],
          id: "tie-a",
          fareVnd: 300_000,
          departureTime: "2099-01-01T02:00:00Z",
        }),
      ]);
      server.use(...createTripHandlers(source));
      const response = await fetch(searchUrl({ sort }));
      const body = resultSchema.parse(await response.json());
      expect(body.items.map((item) => item.id)).toEqual(["tie-z", "tie-a"]);
      expect(source.map((item) => item.id)).toEqual(["tie-z", "tie-a"]);
    },
  );

  it("returns independent payloads so a caller mutation does not affect later requests", async () => {
    const body = resultSchema.parse(await (await fetch(searchUrl())).json());
    expect(body.items).toHaveLength(24);
    body.items.reverse();
    body.items[0].id = "caller-change";
    const next = resultSchema.parse(await (await fetch(searchUrl())).json());
    expect(next.items[0].id).toBe("trip-hcm-dalat-early");
    expect(next.items.some((item) => item.id === "caller-change")).toBe(false);
  });

  it.each<[Record<string, string>, string]>([
    [{ destinationId: "loc-hcm" }, "destinationId"],
    [{ departureDate: "2000-01-01" }, "departureDate"],
    [{ passengerCount: "7" }, "passengerCount"],
    [
      { departureDate: "private-invalid", email: "private@example.invalid" },
      "departureDate",
    ],
  ])("returns sanitized validation Problem Details", async (query, field) => {
    const response = await fetch(searchUrl(query));
    expect(response.status).toBe(400);
    const body = problemSchema.parse(await response.json());
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.errors).toHaveProperty(field);
    expect(JSON.stringify(body)).not.toMatch(
      /issues|invalid_type|expected|received|private/,
    );
  });

  it("rejects missing and duplicate core query parameters", async () => {
    for (const kind of ["missing", "duplicate"]) {
      const url = searchUrl();
      if (kind === "missing") url.searchParams.delete("originId");
      else url.searchParams.append("originId", "private-duplicate");
      const response = await fetch(url);
      expect(response.status).toBe(400);
      const body = problemSchema.parse(await response.json());
      expect(response.status).toBe(400);
      expect(body.errors).toHaveProperty("originId");
      expect(body.instance).toBe("/api/v1/trips");
    }
  });

  it("allows empty scenario only after a valid query", async () => {
    const response = await fetch(searchUrl({ scenario: "empty" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [], total: 0 });
    const invalid = await fetch(
      searchUrl({ scenario: "empty", passengerCount: "0" }),
    );
    expect(invalid.status).toBe(400);
  });

  it("returns an actionable 503 problem for the error scenario", async () => {
    const response = await fetch(searchUrl({ scenario: "error" }));
    expect(response.status).toBe(503);
    const body = problemSchema.parse(await response.json());
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body.status).toBe(503);
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.detail).toContain("thử lại");
    expect(body.errors).toBeUndefined();
  });

  it.each(["empty", "error"])(
    "ignores scenario=%s in production",
    async (scenario) => {
      vi.stubEnv("PROD", true);
      const response = await fetch(searchUrl({ scenario }));
      const body = resultSchema.parse(await response.json());
      expect(response.status).toBe(200);
      expect(body.total).toBe(24);
    },
  );

  it("allows the dev-only scenario when MODE is development", async () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("DEV", true);
    vi.stubEnv("MODE", "development");
    expect(
      await (await fetch(searchUrl({ scenario: "empty" }))).json(),
    ).toEqual({ items: [], total: 0 });
  });

  it("allows a test scenario when DEV is false but MODE is test", async () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("DEV", false);
    vi.stubEnv("MODE", "test");
    expect((await fetch(searchUrl({ scenario: "error" }))).status).toBe(503);
  });

  it("ignores unknown or non-development scenario overrides", async () => {
    const unknown = resultSchema.parse(
      await (await fetch(searchUrl({ scenario: "unknown" }))).json(),
    );
    expect(unknown.total).toBe(24);
    vi.stubEnv("PROD", false);
    vi.stubEnv("DEV", false);
    vi.stubEnv("MODE", "staging");
    for (const scenario of ["error", "unknown"]) {
      const body = resultSchema.parse(
        await (await fetch(searchUrl({ scenario }))).json(),
      );
      expect(body.total).toBe(24);
    }
  });
});
