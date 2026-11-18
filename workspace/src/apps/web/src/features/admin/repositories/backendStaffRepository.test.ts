import { beforeEach, expect, it, vi } from "vitest";
import { liveApiJson } from "@/shared/api/liveRequest";
import {
  createBackendAdminRepository,
  createBackendMembershipRepository,
  updateBackendStaffStatus,
} from "./backendAdminRepository";
vi.mock("@/shared/api/liveRequest", () => ({ liveApiJson: vi.fn() }));
const user = {
  id: "user1",
  fullName: "Staff",
  email: "staff@example.test",
  phone: "+84900000000",
  status: "ACTIVE",
  rowVersion: 3,
  organizationMemberships: [
    {
      id: "m1",
      userId: "user1",
      organizationId: "org1",
      roleCodes: ["DRIVER"],
      status: "ACTIVE",
      createdAt: "2026-11-01T00:00:00Z",
    },
    {
      id: "m2",
      userId: "user1",
      organizationId: "org2",
      roleCodes: ["OPERATOR_SCHEDULER"],
      status: "ACTIVE",
      rowVersion: 4,
      createdAt: "2026-11-02T00:00:00Z",
    },
  ],
};
beforeEach(() => vi.mocked(liveApiJson).mockReset());
it("finds a staff member through their second membership", async () => {
  vi.mocked(liveApiJson).mockResolvedValue({ items: [user], totalPages: 1 });
  const result = await createBackendAdminRepository().listStaff({
    page: 1,
    pageSize: 20,
    organizationId: "org2",
  });
  expect(result.total).toBe(1);
  expect(result.items[0]).toMatchObject({
    id: "user1",
    organizationId: "org2",
    role: "OPERATOR_SCHEDULER",
    memberships: expect.arrayContaining([
      expect.objectContaining({ organizationId: "org1" }),
      expect.objectContaining({ organizationId: "org2" }),
    ]),
  });
});
it("changes account status without rewriting profile or organization roles", async () => {
  vi.mocked(liveApiJson).mockImplementation(async (_path, _schema, options) =>
    options?.method === "PATCH" ? { ...user, status: "DISABLED" } : user,
  );
  await updateBackendStaffStatus("user1", "inactive");
  expect(vi.mocked(liveApiJson).mock.calls.map(([path]) => path)).toEqual([
    "/api/v1/admin/users/user1",
    "/api/v1/admin/users/user1/status",
  ]);
  expect(liveApiJson).toHaveBeenLastCalledWith(
    "/api/v1/admin/users/user1/status",
    expect.anything(),
    expect.objectContaining({
      body: expect.objectContaining({ expectedVersion: 3, status: "DISABLED" }),
    }),
  );
});
it("suspends the selected membership with its actual version", async () => {
  vi.mocked(liveApiJson).mockImplementation(async (_path, _schema, options) =>
    options?.method === "PATCH"
      ? { ...user.organizationMemberships[1], status: "SUSPENDED" }
      : user.organizationMemberships,
  );
  await createBackendMembershipRepository().update({
    staffId: "user1",
    organizationId: "org2",
    role: "DRIVER",
    status: "inactive",
    reason: "Requested change",
  });
  expect(liveApiJson).toHaveBeenLastCalledWith(
    "/api/v1/admin/organizations/org2/members/m2",
    expect.anything(),
    expect.objectContaining({
      body: expect.objectContaining({
        expectedVersion: 4,
        status: "SUSPENDED",
        roleCodes: ["DRIVER"],
      }),
    }),
  );
});
