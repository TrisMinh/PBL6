import { beforeEach, expect, it, vi } from "vitest";
import { liveApiJson } from "@/shared/api/liveRequest";
import { createBackendAdminRepository } from "./backendAdminRepository";
vi.mock("@/shared/api/liveRequest", () => ({ liveApiJson: vi.fn() }));
beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(liveApiJson).mockReset();
});
it("adapts the real organization array and applies original page filters", async () => {
  vi.mocked(liveApiJson).mockResolvedValue([
    {
      id: "real-id",
      code: "REAL-OPERATOR",
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
    query: "REAL-OPERATOR",
  });
  expect(result).toMatchObject({
    total: 1,
    page: 1,
    pageSize: 10,
    items: [
      {
        id: "real-id",
        code: "REAL-OPERATOR",
        name: "Real operator",
        status: "active",
      },
    ],
  });
});
it("lists bookings without fetching a trip per record or synthesizing audit history", async () => {
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
              organizationId: "org",
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
    routeLabel: "—",
    totalVnd: 120000,
    passengerCount: 1,
    status: "paid",
    organizationId: "org",
  });
  expect(result.items[0].audit).toBeUndefined();
  expect(result.items[0].live?.state).toBe("confirmed");
  expect(
    vi
      .mocked(liveApiJson)
      .mock.calls.some(([path]) => String(path).includes("/trips/")),
  ).toBe(false);
});

const organizationInput = {
  name: "Live organization",
  legalName: "Live transport company",
  taxId: "0123456789",
  address: "Test address",
  contactEmail: "operator@example.test",
  contactPhone: "0900000000",
  status: "active" as const,
};
const profilePath = "/api/v1/admin/organizations/real-id/profile";

it("counts every matching organization status before slicing a page", async () => {
  vi.mocked(liveApiJson).mockResolvedValue([
    { id: "one", name: "Operator A", status: "ACTIVE" },
    { id: "two", name: "Operator B", status: "SUSPENDED" },
    { id: "three", name: "Operator C", status: "ACTIVE" },
  ]);
  const repo = createBackendAdminRepository();
  const first = await repo.listOrganizations({ page: 1, pageSize: 1 });
  const last = await repo.listOrganizations({ page: 3, pageSize: 1 });
  expect(first.statusCounts).toEqual({ active: 2, inactive: 1 });
  expect(last.statusCounts).toEqual(first.statusCounts);
  expect(last.items[0].id).toBe("three");
  const filtered = await repo.listOrganizations({
    page: 1,
    pageSize: 1,
    status: "inactive",
  });
  expect(filtered.total).toBe(1);
  expect(filtered.statusCounts).toEqual({ inactive: 1 });
});

it("resumes creation with the same code and request key after a profile failure", async () => {
  let failProfile = true;
  vi.mocked(liveApiJson).mockImplementation(async (path, _schema, options) => {
    if (path === "/api/v1/admin/organizations" && options?.method === "POST")
      return { id: "real-id", rowVersion: 0 };
    if (path === profilePath && options?.method === "PATCH") {
      if (failProfile) {
        failProfile = false;
        throw Object.assign(new Error("Temporarily unavailable"), {
          status: 503,
        });
      }
      return {
        id: "real-id",
        ...organizationInput,
        status: "ACTIVE",
        rowVersion: 8,
      };
    }
    if (path === profilePath) return { id: "real-id", rowVersion: 7 };
    throw new Error(`Unexpected API path: ${path}`);
  });
  await expect(
    createBackendAdminRepository().createOrganization(organizationInput),
  ).rejects.toMatchObject({ status: 503 });
  expect(
    Object.keys(sessionStorage).some((key) =>
      key.startsWith("blue-live-organization:"),
    ),
  ).toBe(true);

  await expect(
    createBackendAdminRepository().createOrganization(organizationInput),
  ).resolves.toMatchObject({
    id: "real-id",
    status: "active",
    legalName: organizationInput.legalName,
  });
  const creates = vi
    .mocked(liveApiJson)
    .mock.calls.filter(([, , options]) => options?.method === "POST");
  expect(creates).toHaveLength(2);
  expect(creates[0][2]?.body).toMatchObject({
    code: expect.stringMatching(/^ORG-[0-9a-f-]{36}$/),
  });
  expect(creates[1][2]?.body).toEqual(creates[0][2]?.body);
  expect(creates[1][2]?.idempotencyKey).toBe(creates[0][2]?.idempotencyKey);
  expect(
    Object.keys(sessionStorage).some((key) =>
      key.startsWith("blue-live-organization:"),
    ),
  ).toBe(false);
  expect(liveApiJson).toHaveBeenCalledWith(
    profilePath,
    expect.anything(),
    expect.objectContaining({
      method: "PATCH",
      body: { ...organizationInput, expectedVersion: 7 },
    }),
  );
});

it("uses the stored organization profile version when updating legal and contact fields", async () => {
  vi.mocked(liveApiJson).mockImplementation(async (path, _schema, options) => {
    expect(path).toBe(profilePath);
    return options?.method === "PATCH"
      ? { id: "real-id", ...organizationInput, status: "ACTIVE" }
      : { id: "real-id", rowVersion: 12 };
  });
  await createBackendAdminRepository().updateOrganization(
    "real-id",
    organizationInput,
  );
  expect(liveApiJson).toHaveBeenLastCalledWith(
    profilePath,
    expect.anything(),
    expect.objectContaining({
      method: "PATCH",
      body: { ...organizationInput, expectedVersion: 12 },
    }),
  );
});
