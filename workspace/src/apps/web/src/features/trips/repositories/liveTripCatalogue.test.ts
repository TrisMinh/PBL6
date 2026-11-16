import { expect, it, vi } from "vitest";
const search = vi.hoisted(() => vi.fn());
const json = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api/client", () => ({ apiJson: json }));
vi.mock("./backendTripRepository", () => ({
  backendTripRepository: { search },
}));
import { loadLiveTripCatalogue } from "./liveTripCatalogue";
it("loads actual routes for the chosen day and deduplicates trips without demo data", async () => {
  json.mockResolvedValue([
    { origin: "Hà Nội", destination: "Đà Nẵng" },
    { origin: "TP. Hồ Chí Minh", destination: "Đà Lạt" },
  ]);
  search.mockImplementation(async (input) => [
    { id: input.originId, origin: { id: input.originId } },
  ]);
  const trips = await loadLiveTripCatalogue("2026-11-17", 2);
  expect(trips).toHaveLength(2);
  expect(search).toHaveBeenCalledWith(
    expect.objectContaining({
      originId: "loc-hanoi",
      destinationId: "loc-danang",
      departureDate: "2026-11-17",
      passengerCount: 2,
    }),
    undefined,
  );
});
