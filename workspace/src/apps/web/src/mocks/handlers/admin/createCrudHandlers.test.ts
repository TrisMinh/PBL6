import { beforeEach, describe, expect, it } from "vitest";

import { MOCK_SESSION_HEADER } from "@/features/auth/config/session";
import type { Organization } from "@/features/admin/types/admin";
import { adminOrganizations } from "@/mocks/fixtures/admin";
import {
  createAdminHandlers,
  createListResponse,
} from "@/mocks/handlers/admin/createCrudHandlers";
import { server } from "@/mocks/server";
import { createMockDb } from "@/mocks/state/mockDb";

const NOW = Date.parse("2026-10-22T10:00:00.000Z");
const ADMIN_TOKEN = "00000000-0000-4000-8000-000000000010";
const CUSTOMER_TOKEN = "00000000-0000-4000-8000-000000000011";

function headers(token = ADMIN_TOKEN, scenario?: string): HeadersInit {
  return {
    [MOCK_SESSION_HEADER]: token,
    ...(scenario ? { "x-mock-scenario": scenario } : {}),
  };
}

function request(
  path: string,
  init: RequestInit = {},
  token = ADMIN_TOKEN,
): Promise<Response> {
  return fetch(new URL(path, window.location.origin), {
    ...init,
    headers: { ...headers(token), ...init.headers },
  });
}

describe("createListResponse", () => {
  it("filters before pagination, returns the filtered total and never mutates seeds", () => {
    const source = adminOrganizations.map((item) => ({ ...item }));
    const before = structuredClone(source);
    const result = createListResponse(source, {
      params: {
        page: 2,
        pageSize: 1,
        query: "demo",
        status: "active",
      },
      matchesQuery: (item, query) =>
        `${item.name} ${item.contactName}`.toLowerCase().includes(query),
      getStatus: (item) => item.status,
      getOrganizationId: (item) => item.id,
    });

    expect(result).toEqual({
      items: [source.find((item) => item.id === "org-sunrise-demo")],
      page: 2,
      pageSize: 1,
      total: 2,
    });
    expect(source).toEqual(before);
    expect(result.items).not.toBe(source);
    expect(result.items[0]).not.toBe(
      source.find((item) => item.id === "org-sunrise-demo"),
    );
  });

  it("applies organization filtering before slicing", () => {
    const result = createListResponse(adminOrganizations, {
      params: {
        organizationId: "org-river-demo",
        page: 1,
        pageSize: 20,
      },
      matchesQuery: () => true,
      getStatus: (item) => item.status,
      getOrganizationId: (item) => item.id,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe("org-river-demo");
  });
});

describe("admin handler factory", () => {
  const db = createMockDb();
  const delays: number[] = [];
  let nextId = 0;

  beforeEach(() => {
    db.reset();
    delays.length = 0;
    nextId = 0;
    db.authSessions.set(ADMIN_TOKEN, {
      token: ADMIN_TOKEN,
      userId: "mock-admin",
      role: "admin",
      createdAt: new Date(NOW).toISOString(),
      expiresAt: new Date(NOW + 60_000).toISOString(),
    });
    db.authSessions.set(CUSTOMER_TOKEN, {
      token: CUSTOMER_TOKEN,
      userId: "mock-customer",
      role: "customer",
      createdAt: new Date(NOW).toISOString(),
      expiresAt: new Date(NOW + 60_000).toISOString(),
    });
    server.use(
      ...createAdminHandlers({
        allowScenarios: true,
        db,
        delay: async (milliseconds) => {
          delays.push(milliseconds);
        },
        id: () => `generated-${++nextId}`,
        now: () => NOW,
      }),
    );
  });

  it("requires a current admin grant before exposing list or detail data", async () => {
    const missing = await fetch(
      new URL("/api/v1/admin/organizations", window.location.origin),
    );
    const expiredToken = "00000000-0000-4000-8000-000000000012";
    db.authSessions.set(expiredToken, {
      token: expiredToken,
      userId: "mock-admin",
      role: "admin",
      createdAt: new Date(NOW - 120_000).toISOString(),
      expiresAt: new Date(NOW - 60_000).toISOString(),
    });
    const expired = await request(
      "/api/v1/admin/organizations",
      {},
      expiredToken,
    );
    const customer = await request(
      "/api/v1/admin/organizations/org-blue-demo",
      {},
      CUSTOMER_TOKEN,
    );

    expect(missing.status).toBe(401);
    expect(expired.status).toBe(401);
    expect(customer.status).toBe(403);
    expect(await missing.json()).toMatchObject({ code: "ACCESS_REQUIRED" });
    expect(await customer.json()).toMatchObject({ code: "FORBIDDEN" });
  });

  it("filters and paginates lists with total after filtering", async () => {
    const response = await request(
      "/api/v1/admin/organizations?query=example&status=active&page=2&pageSize=1",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      items: [adminOrganizations[4]],
      page: 2,
      pageSize: 1,
      total: 7,
    });
  });

  it.each([
    ["empty", 200],
    ["error", 503],
    ["forbidden", 403],
    ["not-found", 200],
  ] as const)(
    "handles list scenario %s with status %i",
    async (scenario, status) => {
      const response = await request("/api/v1/admin/organizations", {
        headers: headers(ADMIN_TOKEN, scenario),
      });
      expect(response.status).toBe(status);
      if (scenario === "empty")
        expect(await response.json()).toEqual({
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
        });
      if (scenario === "not-found")
        expect((await response.json()) as { total: number }).toHaveProperty(
          "total",
          10,
        );
    },
  );

  it("applies a bounded loading delay and detail-only not-found", async () => {
    const loading = await request("/api/v1/admin/staff", {
      headers: headers(ADMIN_TOKEN, "loading"),
    });
    const missing = await request("/api/v1/admin/staff/staff-blue-01", {
      headers: headers(ADMIN_TOKEN, "not-found"),
    });

    expect(loading.status).toBe(200);
    expect(delays).toEqual([200]);
    expect(missing.status).toBe(404);
  });

  it("ignores scenario headers when scenario controls are disabled", async () => {
    server.use(
      ...createAdminHandlers({
        allowScenarios: false,
        db,
        now: () => NOW,
      }),
    );
    const response = await request("/api/v1/admin/organizations", {
      headers: headers(ADMIN_TOKEN, "error"),
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as { total: number }).toHaveProperty(
      "total",
      10,
    );
  });

  it("serves linked read-only booking, payment and refund details", async () => {
    for (const path of [
      "/api/v1/admin/bookings/admin-booking-01",
      "/api/v1/admin/payments/admin-payment-01",
      "/api/v1/admin/refunds/admin-refund-01",
    ]) {
      const response = await request(path);
      expect(response.status).toBe(200);
      expect(await response.json()).toHaveProperty("id");
    }
  });

  it("assigns a second membership without moving the staff account", async () => {
    const input = {
      staffId: "USR-0018",
      organizationId: "ORG-002",
      role: "DRIVER",
      status: "active",
      reason: "Phân công",
    };
    const response = await request("/api/v1/admin/memberships", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "task8-membership-test",
      },
      body: JSON.stringify(input),
    });
    expect(response.status).toBe(201);
    const record = await request("/api/v1/admin/staff/USR-0018");
    expect(await record.json()).toMatchObject({ organizationId: "ORG-001" });
    const list = await request(
      "/api/v1/admin/memberships?organizationId=ORG-002",
    );
    expect(await list.json()).toContainEqual(expect.objectContaining(input));
    const replay = await request("/api/v1/admin/memberships", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "task8-membership-test",
      },
      body: JSON.stringify(input),
    });
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(await response.json());
  });

  it("updates only the selected membership and rejects a changed replay", async () => {
    const input = {
      staffId: "USR-0018",
      organizationId: "ORG-001",
      role: "DRIVER",
      status: "active",
      reason: "Điều chỉnh",
    };
    const update = await request("/api/v1/admin/memberships/ORG-001/USR-0018", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    expect(update.status).toBe(200);
    expect(await update.json()).toMatchObject(input);
    const other = await request(
      "/api/v1/admin/memberships?organizationId=ORG-001&staffId=USR-0019",
    );
    expect(await other.json()).toContainEqual(
      expect.objectContaining({ role: "OPERATOR_SCHEDULER" }),
    );
    const duplicate = await request("/api/v1/admin/memberships", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "same-key",
      },
      body: JSON.stringify({ ...input, organizationId: "ORG-002" }),
    });
    expect(duplicate.status).toBe(201);
    const replay = await request("/api/v1/admin/memberships", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "same-key",
      },
      body: JSON.stringify({ ...input, organizationId: "ORG-003" }),
    });
    expect(replay.status).toBe(400);
  });

  it("creates and updates organizations with injected IDs and timestamps", async () => {
    const body = {
      name: "Northwind Demo Transit",
      contactName: "Điều phối mô phỏng E",
      contactEmail: "ops-e@northwind.example.invalid",
      contactPhone: "0000000199",
      status: "active",
    };
    const createdResponse = await request("/api/v1/admin/organizations", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        ...headers(),
        "Content-Type": "application/json",
      },
    });
    const created = (await createdResponse.json()) as Organization;
    const updatedResponse = await request(
      `/api/v1/admin/organizations/${created.id}`,
      {
        method: "PUT",
        body: JSON.stringify({ ...body, status: "inactive" }),
        headers: {
          ...headers(),
          "Content-Type": "application/json",
        },
      },
    );

    expect(createdResponse.status).toBe(201);
    expect(created).toMatchObject({
      id: "organizations-generated-1",
      createdAt: new Date(NOW).toISOString(),
      updatedAt: new Date(NOW).toISOString(),
    });
    expect(updatedResponse.status).toBe(200);
    expect(await updatedResponse.json()).toMatchObject({
      id: created.id,
      status: "inactive",
      createdAt: created.createdAt,
      updatedAt: new Date(NOW).toISOString(),
    });
  });

  it("validates mutation bodies and staff organization references", async () => {
    const malformed = await request("/api/v1/admin/organizations", {
      method: "POST",
      body: "PRIVATE_NOT_JSON",
      headers: { ...headers(), "Content-Type": "application/json" },
    });
    const foreignStaff = await request("/api/v1/admin/staff", {
      method: "POST",
      body: JSON.stringify({
        organizationId: "org-missing",
        fullName: "Nhân viên mô phỏng E",
        email: "staff-e@missing.example.invalid",
        phone: "0000000299",
        status: "active",
      }),
      headers: { ...headers(), "Content-Type": "application/json" },
    });

    expect(malformed.status).toBe(400);
    expect(foreignStaff.status).toBe(400);
    expect(JSON.stringify(await malformed.json())).not.toContain(
      "PRIVATE_NOT_JSON",
    );
  });

  it("creates and updates staff only for an existing organization", async () => {
    const body = {
      organizationId: "org-blue-demo",
      fullName: "Nhân viên mô phỏng E",
      email: "staff-e@blue.example.invalid",
      phone: "0000000299",
      status: "active",
    };
    const createdResponse = await request("/api/v1/admin/staff", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { ...headers(), "Content-Type": "application/json" },
    });
    const created = (await createdResponse.json()) as {
      id: string;
      createdAt: string;
    };
    const updatedResponse = await request(`/api/v1/admin/staff/${created.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...body, status: "inactive" }),
      headers: { ...headers(), "Content-Type": "application/json" },
    });

    expect(createdResponse.status).toBe(201);
    expect(created).toMatchObject({ id: "staff-generated-1" });
    expect(await updatedResponse.json()).toMatchObject({
      id: created.id,
      createdAt: created.createdAt,
      status: "inactive",
    });
  });

  it("updates platform support account without assigning an operator membership", async () => {
    const existing = await request("/api/v1/admin/staff/USR-0024");
    const staff: unknown = await existing.json();
    if (typeof staff !== "object" || !staff) throw new Error("Missing account");
    const response = await request("/api/v1/admin/staff/USR-0024", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: "platform-blue",
        fullName: "Lê Minh Anh",
        email: "test+usr-0024@example.invalid",
        phone: "0000000000",
        role: "PLATFORM_SUPPORT",
        status: "active",
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: "USR-0024",
      status: "active",
      role: "PLATFORM_SUPPORT",
    });
    const memberships = await request(
      "/api/v1/admin/memberships?staffId=USR-0024",
    );
    expect(await memberships.json()).toEqual([]);
  });
});
