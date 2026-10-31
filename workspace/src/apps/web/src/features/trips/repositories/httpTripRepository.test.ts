import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { httpTripRepository } from "@/features/trips/repositories/httpTripRepository";
import { selectVisibleTrips } from "@/features/trips/lib/tripResults";
import type { TripSearch } from "@/features/trips/types/trip";
import { locations } from "@/mocks/fixtures/locations";
import { trips } from "@/mocks/fixtures/trips";
import { server } from "@/mocks/server";

const SEARCH: TripSearch = {
  originId: "loc-hcm",
  destinationId: "loc-dalat",
  departureDate: "2099-01-01",
  passengerCount: 2,
  sort: "departure",
};

describe("HTTP trip repository", () => {
  it("parses locations from the registered MSW endpoint", async () => {
    expect(await httpTripRepository.getLocations()).toEqual(locations);
  });

  it("unwraps parsed search items into domain trips", async () => {
    const canonicalTrips = trips.slice(0, 24);
    expect(await httpTripRepository.search(SEARCH)).toEqual(
      selectVisibleTrips(canonicalTrips, "departure"),
    );
  });

  it("uses URLSearchParams and sends only the five search fields", async () => {
    const special = { ...SEARCH, originId: "loc hcm&extra=1/" };
    let received: URLSearchParams | undefined;
    server.use(
      http.get("/api/v1/trips", ({ request }) => {
        received = new URL(request.url).searchParams;
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    expect(await httpTripRepository.search(special)).toEqual([]);
    expect(received && Object.fromEntries(received)).toEqual({
      originId: special.originId,
      destinationId: SEARCH.destinationId,
      departureDate: SEARCH.departureDate,
      passengerCount: "2",
      sort: "departure",
    });
  });

  it.each([400, 401, 429, 503])(
    "normalizes HTTP %s without exposing Problem Details strings",
    async (status) => {
      server.use(
        http.get("/api/v1/trips", () =>
          HttpResponse.json(
            {
              type: "about:blank",
              status,
              title: "private server message",
              detail: "private@example.invalid",
              code: "PRIVATE_INTERNAL_CODE",
              traceId: "private-trace",
            },
            { status, headers: { "Content-Type": "application/problem+json" } },
          ),
        ),
      );
      await expect(httpTripRepository.search(SEARCH)).rejects.toMatchObject({
        name: "TripRepositoryError",
        code: "HTTP_ERROR",
        status,
        messageKey: "trips.errors.request",
        canRetry: status === 429 || status >= 500,
        message: "Trip discovery request failed",
      });
    },
  );

  it("uses the same HTTP error for an unparseable non-2xx body", async () => {
    server.use(
      http.get(
        "/api/v1/locations",
        () => new HttpResponse("private server HTML", { status: 502 }),
      ),
    );
    await expect(httpTripRepository.getLocations()).rejects.toMatchObject({
      code: "HTTP_ERROR",
      status: 502,
    });
  });

  it("normalizes network failures", async () => {
    server.use(http.get("/api/v1/trips", () => HttpResponse.error()));
    await expect(httpTripRepository.search(SEARCH)).rejects.toMatchObject({
      name: "TripRepositoryError",
      code: "NETWORK_ERROR",
      status: 0,
      messageKey: "trips.errors.network",
      canRetry: true,
    });
  });

  it.each(["/api/v1/locations", "/api/v1/trips"])(
    "normalizes malformed JSON at %s",
    async (path) => {
      server.use(
        http.get(
          path,
          () =>
            new HttpResponse("{private-invalid", {
              headers: { "Content-Type": "application/json" },
            }),
        ),
      );
      const request = path.endsWith("locations")
        ? httpTripRepository.getLocations()
        : httpTripRepository.search(SEARCH);
      await expect(request).rejects.toMatchObject({
        name: "TripRepositoryError",
        code: "INVALID_RESPONSE",
        status: 200,
        messageKey: "trips.errors.response",
        canRetry: true,
      });
    },
  );

  it.each<[string, unknown]>([
    ["missing items", {}],
    ["empty nested name", { items: [{ ...locations[0], name: "   " }] }],
    ["wrong province type", { items: [{ ...locations[0], province: 1 }] }],
  ])("rejects location contract drift: %s", async (_label, payload) => {
    server.use(
      http.get(
        "/api/v1/locations",
        () =>
          new HttpResponse(JSON.stringify(payload), {
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    await expect(httpTripRepository.getLocations()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 200,
    });
  });

  it.each<[string, unknown]>([
    ["zero fare", { fareVnd: 0 }],
    ["negative fare", { fareVnd: -1 }],
    ["fractional fare", { fareVnd: 1.5 }],
    ["string fare", { fareVnd: "280000" }],
    ["negative seats", { availableSeatCount: -1 }],
    ["fractional seats", { availableSeatCount: 1.5 }],
    ["unknown vehicle", { vehicleType: "bus" }],
    ["missing location", { origin: null }],
    ["empty operator", { operator: { id: "op", name: " " } }],
    ["empty id", { id: "" }],
    ["invalid date", { departureTime: "2099-02-30T00:00:00Z" }],
    ["offset timestamp", { departureTime: "2099-01-01T06:30:00+07:00" }],
    ["arrival before departure", { arrivalTime: "2098-12-31T22:00:00Z" }],
    ["arrival equals departure", { arrivalTime: trips[0].departureTime }],
  ])("rejects Trip contract drift: %s", async (_label, overrides) => {
    const trip = {
      ...trips[0],
      ...(typeof overrides === "object" ? overrides : {}),
    };
    server.use(
      http.get("/api/v1/trips", () =>
        HttpResponse.json({ items: [trip], total: 1 }),
      ),
    );
    await expect(httpTripRepository.search(SEARCH)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 200,
    });
  });

  it.each<[string, unknown]>([
    ["missing total", { items: [] }],
    ["mismatched total", { items: [], total: 1 }],
    ["fractional total", { items: [], total: 0.5 }],
    ["negative total", { items: [], total: -1 }],
  ])("rejects search collection drift: %s", async (_label, payload) => {
    server.use(
      http.get(
        "/api/v1/trips",
        () =>
          new HttpResponse(JSON.stringify(payload), {
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    await expect(httpTripRepository.search(SEARCH)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("parses a new domain payload and strips fields outside the contract", async () => {
    server.use(
      http.get("/api/v1/trips", () =>
        HttpResponse.json({
          items: [
            {
              ...trips[0],
              privateField: "removed",
              origin: { ...trips[0].origin, extra: true },
            },
          ],
          total: 1,
          extra: true,
        }),
      ),
    );
    expect(await httpTripRepository.search(SEARCH)).toEqual([trips[0]]);
  });

  it.each(["locations", "trips"])(
    "forwards cancellation to the actual %s request",
    async (resource) => {
      let onStart: (signal: AbortSignal) => void = () => undefined;
      const started = new Promise<AbortSignal>((resolve) => {
        onStart = resolve;
      });
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.get(`/api/v1/${resource}`, async ({ request }) => {
          onStart(request.signal);
          await held;
          return HttpResponse.json({ items: [], total: 0 });
        }),
      );
      const controller = new AbortController();
      const pending =
        resource === "locations"
          ? httpTripRepository.getLocations(controller.signal)
          : httpTripRepository.search(SEARCH, controller.signal);
      const signal = await started;
      const rejected = expect(pending).rejects.toMatchObject({
        name: "TripRepositoryError",
        code: "ABORTED",
        status: 0,
        messageKey: "trips.errors.cancelled",
        canRetry: false,
      });
      controller.abort();
      await rejected;
      expect(signal.aborted).toBe(true);
      release();
    },
  );
});
