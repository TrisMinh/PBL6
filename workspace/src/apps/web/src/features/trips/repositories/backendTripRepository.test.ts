import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiJson } from "@/shared/api/client";
import { backendTripRepository } from "./backendTripRepository";

vi.mock("@/shared/api/client", () => ({ apiJson: vi.fn() }));
const input = {
  originId: "Đà Nẵng",
  destinationId: "Huế",
  departureDate: "2099-01-01",
  passengerCount: 1,
  sort: "duration-asc" as const,
};
const trip = {
  id: "trip-1",
  organizationId: "operator-1",
  operatorName: "BLUE",
  origin: "Đà Nẵng",
  destination: "Huế",
  departureAt: "2099-01-01T01:00:00Z",
  arrivalAt: "2099-01-01T04:00:00Z",
  fare: { amount: 160000, currency: "VND" },
  availableSeatCount: 24,
  busType: "SLEEPER_34",
  stops: [],
  amenities: [],
  policyVersion: "cancel-mvp-v1",
  allowPayLater: true,
};
describe("live search request", () => {
  beforeEach(() => vi.mocked(apiJson).mockReset());
  it("restores shared route stops and real seat counts without fetching result pages", async () => {
    const stop = {
      id: "pickup-1",
      name: "Bến đón",
      sequence: 0,
      offsetMinutes: 0,
      pickupAllowed: true,
      dropoffAllowed: false,
    };
    vi.mocked(apiJson)
      .mockResolvedValueOnce({
        items: [{ ...trip, routeId: "route-1", stops: undefined }],
        routeStops: { "route-1": [stop] },
      })
      .mockResolvedValueOnce({ [trip.id]: 7 });
    const [row] = await backendTripRepository.search(input, undefined, true, {
      cards: true,
    });
    expect(apiJson).toHaveBeenCalledTimes(2);
    const request = String(vi.mocked(apiJson).mock.calls[0][0]);
    expect(request).toContain("cards=true");
    expect(request).not.toContain("page=");
    expect(row).toMatchObject({
      stops: [stop],
      originStopName: stop.name,
      availableSeatCount: 7,
      seatCountIsCapacity: false,
    });
  });

  it("sends operator and stop filters with duration sorting", async () => {
    vi.mocked(apiJson)
      .mockResolvedValueOnce({ items: [trip], totalPages: 1 })
      .mockResolvedValueOnce({ "trip-1": 7 });
    const rows = await backendTripRepository.search({
      ...input,
      filters: {
        organizationId: "operator-1",
        pickupStopId: "pickup-1",
        dropoffStopId: "dropoff-1",
      },
    });
    const url = new URL(
      String(vi.mocked(apiJson).mock.calls[0][0]),
      "https://test.invalid",
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      organizationId: "operator-1",
      pickupStopId: "pickup-1",
      dropoffStopId: "dropoff-1",
      sort: "DURATION_ASC",
    });
    expect(rows[0]).toMatchObject({
      policyVersion: "cancel-mvp-v1",
      allowPayLater: true,
      seatCountIsCapacity: false,
      availableSeatCount: 7,
    });
  });
  it("keeps backend duration order across pages instead of reordering by departure", async () => {
    vi.mocked(apiJson)
      .mockResolvedValueOnce({
        items: [
          {
            ...trip,
            id: "short",
            departureAt: "2099-01-01T12:00:00Z",
            arrivalAt: "2099-01-01T13:00:00Z",
          },
        ],
        totalPages: 2,
      })
      .mockResolvedValueOnce({ items: [trip], totalPages: 2 })
      .mockResolvedValueOnce({ short: 8, "trip-1": 7 });
    expect(
      (await backendTripRepository.search(input)).map((row) => row.id),
    ).toEqual(["short", "trip-1"]);
    expect(String(vi.mocked(apiJson).mock.calls[1][0])).toContain("page=1");
  });
});

it("loads the public catalogue without inventing route or date criteria", async () => {
  vi.mocked(apiJson).mockReset();
  vi.mocked(apiJson)
    .mockResolvedValueOnce({ items: [trip], totalPages: 1 })
    .mockResolvedValueOnce({ "trip-1": 7 });
  const rows = await backendTripRepository.search({
    ...input,
    originId: "",
    destinationId: "",
    departureDate: "",
  });
  const url = new URL(
    String(vi.mocked(apiJson).mock.calls[0][0]),
    "https://test.invalid",
  );
  expect(url.searchParams.has("origin")).toBe(false);
  expect(url.searchParams.has("departureDate")).toBe(false);
  expect(rows[0].origin.id).toBe(input.originId);
});

it("reads availability for a large result in one body request and keeps sold-out trips", async () => {
  const trips = Array.from({ length: 101 }, (_, index) => ({
    ...trip,
    id: `trip-${index}`,
  }));
  vi.mocked(apiJson)
    .mockReset()
    .mockResolvedValueOnce({ items: trips.slice(0, 100), totalPages: 2 })
    .mockResolvedValueOnce({ items: trips.slice(100), totalPages: 2 })
    .mockResolvedValueOnce({ "trip-100": 3 });
  const result = await backendTripRepository.search(input);
  expect(result).toHaveLength(101);
  expect(result[0].availableSeatCount).toBe(0);
  expect(result[100].availableSeatCount).toBe(3);
  expect(apiJson).toHaveBeenLastCalledWith(
    "/api/v1/trips/availability",
    expect.anything(),
    expect.objectContaining({
      method: "POST",
      body: { tripIds: trips.map(({ id }) => id) },
    }),
  );
});
