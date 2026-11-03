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
  it("sends operator and stop filters with duration sorting", async () => {
    vi.mocked(apiJson).mockResolvedValue({ items: [trip], totalPages: 1 });
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
      seatCountIsCapacity: true,
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
      .mockResolvedValueOnce({ items: [trip], totalPages: 2 });
    expect(
      (await backendTripRepository.search(input)).map((row) => row.id),
    ).toEqual(["short", "trip-1"]);
    expect(String(vi.mocked(apiJson).mock.calls[1][0])).toContain("page=1");
  });
});
