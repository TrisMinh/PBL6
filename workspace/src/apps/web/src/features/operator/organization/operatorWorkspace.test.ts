import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  rows: vi.fn(),
  request: vi.fn(),
  metadata: vi.fn(),
  saveMetadata: vi.fn(),
  localDateTime: (v: string) => v.slice(0, 16),
}));
vi.mock("../liveOriginalApi", () => api);
import {
  readWorkspace,
  saveOrganization,
  saveMember,
  setMemberStatus,
  settlementTotals,
  settlementCsv,
} from "./operatorWorkspace";
beforeEach(() => {
  vi.clearAllMocks();
  api.rows.mockResolvedValue([]);
  api.metadata.mockResolvedValue({});
  api.request.mockResolvedValue({
    id: "org",
    name: "Real operator",
    code: "REAL",
    contactEmail: "real@example.com",
    contactPhone: "0901234567",
    allowPayLater: false,
    rowVersion: 4,
  });
});
it("loads the organization from the server without browser fixture seeds", async () => {
  api.metadata.mockResolvedValue({
    org: { logoUrl: "data:image/webp;base64,bG9nbw==" },
  });
  sessionStorage.setItem(
    "blue-operator-workspace-v1",
    JSON.stringify({ organization: { name: "Fake" } }),
  );
  const value = await readWorkspace();
  expect(value.organization.name).toBe("Real operator");
  expect(value.organization.logoUrl).toBe("data:image/webp;base64,bG9nbw==");
  expect(value.members).toEqual([]);
  expect(value.settlements).toEqual([]);
});
it("excludes customer memberships instead of inventing a staff role", async () => {
  api.rows.mockResolvedValue([
    { id: "customer", fullName: "Customer", roleCodes: [], status: "ACTIVE" },
    {
      id: "driver",
      fullName: "Driver",
      roleCodes: ["DRIVER"],
      status: "ACTIVE",
    },
  ]);
  expect(
    (await readWorkspace()).members.map((member) => [member.id, member.role]),
  ).toEqual([["driver", "driver"]]);
});
it("persists primary organization fields with the current server version before metadata", async () => {
  await saveOrganization({
    name: "New name",
    code: "REAL",
    email: "real@example.com",
    phone: "0901234567",
    address: "Address",
    taxCode: "0312345678",
    allowPayLater: true,
    logoUrl: "data:image/webp;base64,bG9nbw==",
  });
  expect(api.request).toHaveBeenCalledWith(
    "/api/v1/operator/organization",
    "PATCH",
    expect.objectContaining({ name: "New name", expectedVersion: 4 }),
  );
  expect(api.saveMetadata).toHaveBeenCalledWith(
    "organization",
    "org",
    expect.objectContaining({
      address: "Address",
      logoUrl: "data:image/webp;base64,bG9nbw==",
    }),
  );
});
it("propagates server errors without reporting a successful local save", async () => {
  api.request.mockRejectedValue(Error("Access denied"));
  await expect(
    saveMember({
      name: "Person",
      email: "person@example.com",
      phone: "0901234567",
      role: "dispatcher",
    }),
  ).rejects.toThrow("Access denied");
  expect(api.saveMetadata).not.toHaveBeenCalled();
});
it("uses real membership id and version for status changes", async () => {
  api.rows.mockResolvedValue([
    {
      id: "member",
      status: "ACTIVE",
      roleCodes: ["CUSTOMER", "DRIVER"],
      rowVersion: 8,
    },
  ]);
  await setMemberStatus("member", "suspended");
  expect(api.request).toHaveBeenCalledWith(
    "/api/v1/operator/staff/member",
    "PATCH",
    { role: "DRIVER", status: "SUSPENDED", expectedVersion: 8 },
  );
});
it("rejects a roleless membership without sending an invalid update", async () => {
  api.rows.mockResolvedValue([
    { id: "member", status: "ACTIVE", roleCodes: [], rowVersion: 0 },
  ]);
  await expect(setMemberStatus("member", "suspended")).rejects.toThrow(
    "chưa được phân vai trò",
  );
  expect(api.request).not.toHaveBeenCalled();
});
it("protects the last active operator administrator", async () => {
  api.rows.mockResolvedValue([
    {
      id: "admin",
      status: "ACTIVE",
      roleCodes: ["OPERATOR_ADMIN"],
      rowVersion: 0,
    },
  ]);
  await expect(setMemberStatus("admin", "suspended")).rejects.toThrow(
    "quản trị viên cuối cùng",
  );
  expect(api.request).not.toHaveBeenCalled();
});
it("calculates amounts and escapes CSV values", () => {
  const items = [
    {
      code: 'a"b',
      bookingCode: "BOOK",
      route: "A",
      date: "2026-11-16",
      gross: 100,
      refunds: 10,
      commission: 5,
      status: "pending" as const,
      reference: "",
    },
  ];
  expect(settlementTotals(items)).toEqual({
    gross: 100,
    refunds: 10,
    commission: 5,
    net: 85,
  });
  expect(settlementCsv(items)).toContain('"a""b"');
});
