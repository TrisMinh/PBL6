import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  rows: vi.fn(),
  json: vi.fn(),
  mutation: vi.fn(),
}));
vi.mock("@/shared/api/liveRequest", () => ({
  getLiveRows: api.rows,
  liveApiJson: api.mutation,
}));
vi.mock("@/shared/api/client", () => ({ apiJson: api.json }));
import {
  backendAdminRepository,
  backendMembershipRepository,
} from "./backendAdminRepository";
beforeEach(() => vi.resetAllMocks());
it("keeps real organization IDs for navigation and exposes the display code without inventing dates", async () => {
  api.rows.mockResolvedValue([
    {
      id: "org-one",
      code: "BLUE01",
      name: "BLUE",
      status: "ACTIVE",
      contactEmail: "operator@example.test",
      contactPhone: "+84912345678",
    },
  ]);
  const result = await backendAdminRepository.listOrganizations({
    page: 1,
    pageSize: 20,
  });
  expect(result.items[0]).toMatchObject({
    id: "org-one",
    code: "BLUE01",
    status: "active",
    createdAt: "",
    updatedAt: "",
  });
  expect(result.total).toBe(1);
});
it("joins booking routes before applying the organization filter and retains actual expired status", async () => {
  api.rows.mockResolvedValue([
    {
      id: "b1",
      code: "BKONE",
      tripId: "t1",
      status: "EXPIRED",
      contact: { fullName: "Passenger" },
      items: [{ seatId: "s1" }],
      total: 250000,
    },
  ]);
  api.json.mockResolvedValue({
    id: "t1",
    organizationId: "org-one",
    origin: "Hà Nội",
    destination: "Đà Nẵng",
  });
  const result = await backendAdminRepository.listBookings({
    page: 1,
    pageSize: 20,
    organizationId: "org-one",
  });
  expect(result.items[0]).toMatchObject({
    bookingCode: "BKONE",
    routeLabel: "Hà Nội → Đà Nẵng",
    rawStatus: "EXPIRED",
    passengerCount: 1,
    totalVnd: 250000,
  });
  expect(
    (
      await backendAdminRepository.listBookings({
        page: 1,
        pageSize: 20,
        organizationId: "other",
      })
    ).items,
  ).toEqual([]);
});
it("reads real memberships and uses the backend operations role when editing scheduling access", async () => {
  api.rows.mockResolvedValue([
    {
      id: "m1",
      userId: "u1",
      organizationId: "o1",
      status: "ACTIVE",
      roleCodes: ["OPERATOR_OPERATIONS"],
      rowVersion: 4,
    },
  ]);
  api.mutation.mockResolvedValue({
    userId: "u1",
    organizationId: "o1",
    status: "ACTIVE",
    roleCodes: ["OPERATOR_OPERATIONS"],
  });
  const result = await backendMembershipRepository.update({
    staffId: "u1",
    organizationId: "o1",
    role: "OPERATOR_SCHEDULER",
    status: "active",
    reason: "Điều phối lịch chuyến",
  });
  expect(api.mutation).toHaveBeenCalledWith(
    "/api/v1/admin/organizations/o1/members/m1",
    expect.anything(),
    expect.objectContaining({
      method: "PATCH",
      body: expect.objectContaining({
        roleCodes: ["OPERATOR_OPERATIONS"],
        expectedVersion: 4,
      }),
    }),
  );
  expect(result.role).toBe("OPERATOR_SCHEDULER");
});
