import { expect, it, vi } from "vitest";
const rows = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api/liveRequest", () => ({ getLiveRows: rows }));
vi.mock("@/shared/api/config", () => ({ isMockApi: false, apiBaseUrl: "" }));
import { getSchedule } from "./scheduleRepository";
it("feeds the original schedule cards with Vietnam time, actual capacity and active booking counts", async () => {
  rows.mockImplementation(async (url: string) =>
    url.endsWith("/trips")
      ? [
          {
            id: "t1",
            origin: "Hà Nội",
            destination: "Đà Nẵng",
            departureAt: "2026-11-17T23:00:00Z",
            arrivalAt: "2026-11-18T08:00:00Z",
            status: "SCHEDULED",
            busId: "b1",
            driverId: "d1",
          },
        ]
      : url.endsWith("/buses")
        ? [
            {
              id: "b1",
              plateNumber: "51B-123.45",
              type: "LIMOUSINE_11",
              seats: [{}, {}, {}],
            },
          ]
        : url.endsWith("/bookings")
          ? [
              { tripId: "t1", status: "PAID", items: [{}, {}] },
              { tripId: "t1", status: "EXPIRED", items: [{}] },
            ]
          : [{ id: "d1", fullName: "Tài xế An" }],
  );
  const result = await getSchedule();
  expect(result[0]).toMatchObject({
    id: "t1",
    date: "2026-11-18",
    departure: "06:00",
    arrival: "15:00",
    capacity: 3,
    passengers: 2,
    crew: "Tài xế An",
    assignment: "complete",
  });
  expect(
    rows.mock.calls.every(([url]) => !String(url).includes("preview")),
  ).toBe(true);
});
