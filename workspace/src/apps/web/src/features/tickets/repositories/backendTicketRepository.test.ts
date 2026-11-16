import { describe, it, expect, vi } from "vitest";
vi.mock("@/shared/api/client", () => ({ apiJson: vi.fn() }));
vi.mock("@/features/trips/repositories/backendTripRepository", () => ({
  getBackendTrip: vi.fn(),
  toTrip: vi.fn((v) => v),
}));
import { apiJson } from "@/shared/api/client";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import { hydrateBackendTicket } from "./backendTicketRepository";
describe("live ticket adapter", () => {
  it("uses real booking item and ticket identifiers without inventing a payment transaction", async () => {
    vi.mocked(apiJson).mockResolvedValue({
      id: "booking",
      code: "BK-123",
      items: [
        {
          seatId: "seat",
          fullName: "An",
          pickupStopId: "a",
          dropoffStopId: "b",
        },
      ],
    });
    vi.mocked(getBackendTrip).mockResolvedValue({
      id: "trip",
      amenities: [],
      fare: { amount: 120000 },
      stops: [
        { id: "a", name: "Pickup" },
        { id: "b", name: "Dropoff" },
      ],
    } as never);
    const result = await hydrateBackendTicket({
      id: "ticket",
      publicCode: "TKT-123",
      bookingId: "booking",
      tripId: "trip",
      passengerName: "An",
      seatCode: "A01",
      status: "ISSUED",
      paymentChannel: "PREPAID",
      issuedAt: "2026-11-16T00:00:00Z",
      rowVersion: 1,
    });
    expect(result).toMatchObject({
      ticketId: "ticket",
      ticketCode: "TKT-123",
      bookingCode: "BK-123",
      seatId: "seat",
      transactionId: "",
      fareVnd: 120000,
    });
  });
});
