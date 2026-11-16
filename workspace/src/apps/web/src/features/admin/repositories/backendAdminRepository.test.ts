import { expect, it, vi } from "vitest";
import { liveApiJson } from "@/shared/api/liveRequest";
import { createBackendAdminRepository } from "./backendAdminRepository";
vi.mock("@/shared/api/liveRequest", () => ({ liveApiJson: vi.fn() }));
it("adapts the real organization array and applies original page filters", async () => {
  vi.mocked(liveApiJson).mockResolvedValue([
    {
      id: "real-id",
      name: "Real operator",
      contactEmail: "ops@example.test",
      contactPhone: "0900000000",
      status: "ACTIVE",
      rowVersion: 5,
    },
  ]);
  const result = await createBackendAdminRepository().listOrganizations({
    page: 1,
    pageSize: 10,
    query: "Real",
  });
  expect(result).toMatchObject({
    total: 1,
    page: 1,
    pageSize: 10,
    items: [{ id: "real-id", name: "Real operator", status: "active" }],
  });
});
it("joins booking trip data without synthesizing audit history", async () => {
  vi.mocked(liveApiJson).mockImplementation(async (path) =>
    String(path).includes("trips/")
      ? { origin: "A", destination: "B", organizationId: "org" }
      : {
          page: 0,
          totalPages: 1,
          items: [
            {
              id: "b",
              code: "REAL",
              tripId: "trip",
              contact: { fullName: "Passenger" },
              items: [{ seatCode: "A1" }],
              total: 120000,
              status: "CONFIRMED",
              createdAt: "2026-11-16T00:00:00Z",
            },
          ],
        },
  );
  const result = await createBackendAdminRepository().listBookings({
    page: 1,
    pageSize: 10,
  });
  expect(result.items[0]).toMatchObject({
    bookingCode: "REAL",
    routeLabel: "A → B",
    totalVnd: 120000,
    passengerCount: 1,
    status: "paid",
    organizationId: "org",
  });
  expect(result.items[0].audit).toBeUndefined();
});
