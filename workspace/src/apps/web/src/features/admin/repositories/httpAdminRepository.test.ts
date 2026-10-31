import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { MOCK_SESSION_HEADER } from "@/features/auth/config/session";
import type { AdminListParams } from "@/features/admin/schemas/adminListParams.schema";
import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
  Organization,
  Staff,
} from "@/features/admin/types/admin";
import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import { createHttpAdminRepository } from "@/features/admin/repositories/httpAdminRepository";
import { createAdminHandlers } from "@/mocks/handlers/admin/createCrudHandlers";
import { adminOrganizations } from "@/mocks/fixtures/admin";
import { server } from "@/mocks/server";
import { createMockDb } from "@/mocks/state/mockDb";

const NOW = Date.parse("2026-10-22T10:00:00.000Z");
const ADMIN_TOKEN = "00000000-0000-4000-8000-000000000020";
const CUSTOMER_TOKEN = "00000000-0000-4000-8000-000000000021";
const DEFAULT_PARAMS: AdminListParams = { page: 1, pageSize: 20 };

describe("HTTP admin repository", () => {
  const db = createMockDb();

  beforeEach(() => {
    db.reset();
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
    server.use(...createAdminHandlers({ db, now: () => NOW }));
  });

  it.each<{
    name: string;
    list: () => Promise<{ items: unknown[]; total: number }>;
    detail: () => Promise<unknown>;
    expectedId: string;
  }>([
    {
      name: "organizations",
      list: () =>
        createHttpAdminRepository({
          sessionToken: ADMIN_TOKEN,
        }).listOrganizations(DEFAULT_PARAMS),
      detail: () =>
        createHttpAdminRepository({
          sessionToken: ADMIN_TOKEN,
        }).getOrganization("org-blue-demo"),
      expectedId: "org-blue-demo",
    },
    {
      name: "staff",
      list: () =>
        createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).listStaff(
          DEFAULT_PARAMS,
        ),
      detail: () =>
        createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).getStaff(
          "staff-blue-01",
        ),
      expectedId: "staff-blue-01",
    },
    {
      name: "bookings",
      list: () =>
        createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).listBookings(
          DEFAULT_PARAMS,
        ),
      detail: () =>
        createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).getBooking(
          "admin-booking-01",
        ),
      expectedId: "admin-booking-01",
    },
    {
      name: "payments",
      list: () =>
        createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).listPayments(
          DEFAULT_PARAMS,
        ),
      detail: () =>
        createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).getPayment(
          "admin-payment-01",
        ),
      expectedId: "admin-payment-01",
    },
    {
      name: "refunds",
      list: () =>
        createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).listRefunds(
          DEFAULT_PARAMS,
        ),
      detail: () =>
        createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).getRefund(
          "admin-refund-01",
        ),
      expectedId: "admin-refund-01",
    },
  ])("parses one $name list and detail through MSW", async (sample) => {
    const list = await sample.list();
    const detail = (await sample.detail()) as { id: string };

    expect(list.total).toBeGreaterThan(0);
    expect(list.items).toHaveLength(list.total);
    expect(detail.id).toBe(sample.expectedId);
  });

  it("serializes only canonical list params and sends explicit access", async () => {
    let url = "";
    let token: string | null = null;
    server.use(
      http.get("/api/v1/admin/organizations", ({ request }) => {
        url = request.url;
        token = request.headers.get(MOCK_SESSION_HEADER);
        return HttpResponse.json({
          items: [],
          page: 2,
          pageSize: 1,
          total: 0,
        });
      }),
    );
    const input = {
      query: " Demo ",
      status: "active" as const,
      organizationId: "org-blue-demo",
      page: 2,
      pageSize: 1,
      secret: "must-not-leak",
    };

    await createHttpAdminRepository({
      sessionToken: ADMIN_TOKEN,
    }).listOrganizations(input);

    expect(new URL(url).searchParams.toString()).toBe(
      "query=Demo&status=active&organizationId=org-blue-demo&page=2&pageSize=1",
    );
    expect(url).not.toContain("secret");
    expect(token).toBe(ADMIN_TOKEN);
  });

  it.each([
    ["missing", "00000000-0000-4000-8000-000000000099", 401],
    ["customer", CUSTOMER_TOKEN, 403],
  ] as const)(
    "keeps %s access failure distinguishable",
    async (_name, token, status) => {
      await expect(
        createHttpAdminRepository({ sessionToken: token }).listOrganizations(
          DEFAULT_PARAMS,
        ),
      ).rejects.toMatchObject({
        name: "AdminRepositoryError",
        code: "HTTP_ERROR",
        status,
      });
    },
  );

  it("keeps detail 404 distinguishable without exposing the server body", async () => {
    await expect(
      createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).getOrganization(
        "org-does-not-exist",
      ),
    ).rejects.toMatchObject({
      name: "AdminRepositoryError",
      message: "Admin request failed",
      code: "HTTP_ERROR",
      status: 404,
    });
  });

  it("rejects malformed successful payloads at the boundary", async () => {
    server.use(
      http.get("/api/v1/admin/bookings/admin-booking-01", () =>
        HttpResponse.json({ id: "admin-booking-01", totalVnd: 0.5 }),
      ),
    );

    await expect(
      createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).getBooking(
        "admin-booking-01",
      ),
    ).rejects.toMatchObject({
      name: "AdminRepositoryError",
      code: "INVALID_RESPONSE",
      status: 200,
    });
  });

  it("rejects impossible pagination metadata", async () => {
    server.use(
      http.get("/api/v1/admin/organizations", () =>
        HttpResponse.json({
          items: [adminOrganizations[0]],
          page: 1,
          pageSize: 20,
          total: 0,
        }),
      ),
    );

    await expect(
      createHttpAdminRepository({
        sessionToken: ADMIN_TOKEN,
      }).listOrganizations(DEFAULT_PARAMS),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 200 });
  });

  it.each([
    ["unexpected status", () => HttpResponse.json({}, { status: 202 })],
    [
      "invalid JSON",
      () =>
        new HttpResponse("not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ],
  ] as const)(
    "normalizes %s without returning raw response data",
    async (_name, response) => {
      server.use(
        http.get("/api/v1/admin/organizations/org-blue-demo", response),
      );

      await expect(
        createHttpAdminRepository({
          sessionToken: ADMIN_TOKEN,
        }).getOrganization("org-blue-demo"),
      ).rejects.toMatchObject({
        name: "AdminRepositoryError",
        message: "Admin request failed",
        code: "INVALID_RESPONSE",
      });
    },
  );

  it("normalizes a transport failure", async () => {
    server.use(http.get("/api/v1/admin/refunds", () => HttpResponse.error()));

    await expect(
      createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).listRefunds(
        DEFAULT_PARAMS,
      ),
    ).rejects.toMatchObject({
      name: "AdminRepositoryError",
      code: "NETWORK_ERROR",
      status: 0,
    });
  });

  it("forwards AbortSignal and normalizes aborts", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      createHttpAdminRepository({ sessionToken: ADMIN_TOKEN }).listRefunds(
        DEFAULT_PARAMS,
        controller.signal,
      ),
    ).rejects.toMatchObject({
      name: "AdminRepositoryError",
      code: "ABORTED",
      status: 0,
    });
  });

  it("validates explicit access before issuing a request", async () => {
    await expect(
      createHttpAdminRepository({ sessionToken: "not-a-session" }).listStaff(
        DEFAULT_PARAMS,
      ),
    ).rejects.toMatchObject({
      name: "AdminRepositoryError",
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("rejects invalid list params and IDs before issuing a request", async () => {
    const repository = createHttpAdminRepository({ sessionToken: ADMIN_TOKEN });

    await expect(
      repository.listBookings({ page: 0, pageSize: 20 }),
    ).rejects.toBeInstanceOf(AdminRepositoryError);
    await expect(repository.getPayment("../private")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("parses organization and staff create/update boundaries", async () => {
    const repository = createHttpAdminRepository({ sessionToken: ADMIN_TOKEN });
    const organizationInput = {
      name: "Northwind Demo Transit",
      contactName: "Điều phối mô phỏng E",
      contactEmail: "ops-e@northwind.example.invalid",
      contactPhone: "0000000199",
      status: "active" as const,
    };
    const organization = await repository.createOrganization(organizationInput);
    const updatedOrganization = await repository.updateOrganization(
      organization.id,
      { ...organizationInput, status: "inactive" },
    );
    const staffInput = {
      organizationId: organization.id,
      fullName: "Nhân viên mô phỏng E",
      email: "staff-e@northwind.example.invalid",
      phone: "0000000299",
      status: "active" as const,
    };
    const staff = await repository.createStaff(staffInput);
    const updatedStaff = await repository.updateStaff(staff.id, {
      ...staffInput,
      status: "inactive",
    });

    expect(organization satisfies Organization).toMatchObject({
      status: "active",
    });
    expect(updatedOrganization).toMatchObject({ status: "inactive" });
    expect(staff satisfies Staff).toMatchObject({ status: "active" });
    expect(updatedStaff).toMatchObject({ status: "inactive" });
  });

  it("keeps transaction detail return types exact", async () => {
    const repository = createHttpAdminRepository({ sessionToken: ADMIN_TOKEN });
    const booking: AdminBooking =
      await repository.getBooking("admin-booking-01");
    const payment: AdminPayment =
      await repository.getPayment("admin-payment-01");
    const refund: AdminRefund = await repository.getRefund("admin-refund-01");

    expect([booking.id, payment.id, refund.id]).toEqual([
      "admin-booking-01",
      "admin-payment-01",
      "admin-refund-01",
    ]);
  });
});
