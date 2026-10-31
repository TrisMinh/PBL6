import { http, HttpResponse, type HttpHandler } from "msw";
import { z } from "zod";

import { parseAdminListParams } from "@/features/admin/schemas/adminListParams.schema";
import type { AdminListParams } from "@/features/admin/schemas/adminListParams.schema";
import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
  Organization,
  Staff,
  Membership,
} from "@/features/admin/types/admin";
import { membershipInputSchema } from "@/features/admin/schemas/adminResponse.schema";
import type { PagedResult } from "@/features/admin/types/pagination";
import {
  adminBookings,
  adminOrganizations,
  adminPayments,
  adminRefunds,
  adminStaff,
} from "@/mocks/fixtures/admin";
import { readAuthGrant } from "@/mocks/state/authState";
import { mockDb, type MockDb } from "@/mocks/state/mockDb";

type AdminEntity =
  Organization | Staff | AdminBooking | AdminPayment | AdminRefund;
type Scenario = "loading" | "empty" | "error" | "forbidden" | "not-found";

interface ListOptions<T> {
  params: AdminListParams;
  matchesQuery: (item: T, normalizedQuery: string) => boolean;
  getStatus: (item: T) => string;
  getOrganizationId: (item: T) => string | undefined;
}

interface AdminContext {
  db: MockDb;
  now: () => number;
  allowScenarios: boolean;
  delay: (milliseconds: number) => Promise<void>;
  id: () => string;
}

interface ReadOptions<T extends AdminEntity> {
  resource: string;
  items: T[];
  matchesQuery: ListOptions<T>["matchesQuery"];
  getStatus: ListOptions<T>["getStatus"];
  getOrganizationId: ListOptions<T>["getOrganizationId"];
  includeInList?: (item: T) => boolean;
}

interface ServerFields {
  id: string;
  createdAt: string;
  updatedAt: string;
}

interface CrudOptions<
  T extends AdminEntity,
  TBody extends object,
> extends ReadOptions<T> {
  bodySchema?: z.ZodType<TBody>;
  build?: (body: TBody, fields: ServerFields) => T;
  validateBody?: (body: TBody) => boolean;
}

interface AdminCollections {
  organizations: Organization[];
  staff: Staff[];
  bookings: AdminBooking[];
  payments: AdminPayment[];
  refunds: AdminRefund[];
}

const organizationBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    contactName: z.string().trim().max(120).optional(),
    legalName: z.string().trim().max(160).optional(),
    taxId: z.string().trim().max(30).optional(),
    address: z.string().trim().max(240).optional(),
    contactEmail: z.email().max(160),
    contactPhone: z
      .string()
      .trim()
      .regex(/^\d{10,15}$/),
    status: z.enum(["active", "inactive"]),
  })
  .strict();
const staffBodySchema = z
  .object({
    organizationId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    fullName: z.string().trim().min(1).max(120),
    email: z.email().max(160),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10,15}$/),
    status: z.enum(["active", "inactive"]),
    role: z
      .enum([
        "OPERATOR_ADMIN",
        "OPERATOR_SCHEDULER",
        "DRIVER",
        "PLATFORM_SUPPORT",
      ])
      .optional(),
    membershipReason: z.string().trim().max(500).optional(),
  })
  .strict();

function adminJson(data: unknown, status = 200): Response {
  return new HttpResponse(JSON.stringify(data), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

export function createListResponse<T>(
  source: readonly T[],
  options: ListOptions<T>,
): PagedResult<T> {
  const query = options.params.query?.toLowerCase();
  const filtered = source.filter(
    (item) =>
      (!query || options.matchesQuery(item, query)) &&
      (!options.params.status ||
        options.getStatus(item) === options.params.status) &&
      (!options.params.organizationId ||
        options.getOrganizationId(item) === options.params.organizationId),
  );
  const start = (options.params.page - 1) * options.params.pageSize;
  return {
    items: filtered
      .slice(start, start + options.params.pageSize)
      .map((item) => structuredClone(item)),
    page: options.params.page,
    pageSize: options.params.pageSize,
    total: filtered.length,
  };
}

function adminProblem(
  code:
    | "ACCESS_REQUIRED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "SERVICE_UNAVAILABLE"
    | "VALIDATION_ERROR",
  instance: string,
): Response {
  const status = {
    ACCESS_REQUIRED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    SERVICE_UNAVAILABLE: 503,
    VALIDATION_ERROR: 400,
  }[code];
  return HttpResponse.json(
    {
      type: "about:blank",
      title: "Chưa thể xử lý dữ liệu quản trị",
      status,
      code,
      traceId: crypto.randomUUID(),
      instance,
      detail: "Kiểm tra quyền truy cập, dữ liệu gửi lên hoặc thử lại sau.",
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/problem+json",
      },
    },
  );
}

function authorize(
  context: AdminContext,
  request: Request,
  instance: string,
): Response | null {
  context.db.hydrate(context.now());
  const grant = readAuthGrant(context.db, request, context.now());
  if (!grant) return adminProblem("ACCESS_REQUIRED", instance);
  return grant.role === "admin" ? null : adminProblem("FORBIDDEN", instance);
}

function readScenario(
  context: AdminContext,
  request: Request,
): Scenario | null {
  if (!context.allowScenarios) return null;
  const scenario = request.headers.get("x-mock-scenario");
  switch (scenario) {
    case "loading":
    case "empty":
    case "error":
    case "forbidden":
    case "not-found":
      return scenario;
    default:
      return null;
  }
}

async function scenarioResponse(
  context: AdminContext,
  request: Request,
  instance: string,
  kind: "list" | "detail" | "mutation",
  params?: AdminListParams,
): Promise<Response | null> {
  const scenario = readScenario(context, request);
  if (scenario === "loading") await context.delay(200);
  if (scenario === "error")
    return adminProblem("SERVICE_UNAVAILABLE", instance);
  if (scenario === "forbidden") return adminProblem("FORBIDDEN", instance);
  if (scenario === "not-found" && kind === "detail")
    return adminProblem("NOT_FOUND", instance);
  if (scenario === "empty" && kind === "list" && params)
    return adminJson({
      items: [],
      page: params.page,
      pageSize: params.pageSize,
      total: 0,
    });
  return null;
}

async function readBody<TBody extends object>(
  request: Request,
  schema: z.ZodType<TBody>,
): Promise<TBody | null> {
  try {
    const parsed = schema.safeParse(await request.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function handleList<T extends AdminEntity, TBody extends object>(
  context: AdminContext,
  options: CrudOptions<T, TBody>,
  request: Request,
): Promise<Response> {
  const instance = `/api/v1/admin/${options.resource}`;
  const denied = authorize(context, request, instance);
  if (denied) return denied;
  const params = parseAdminListParams(new URL(request.url).searchParams);
  const scenario = await scenarioResponse(
    context,
    request,
    instance,
    "list",
    params,
  );
  if (scenario) return scenario;
  const items = options.includeInList
    ? options.items.filter(options.includeInList)
    : options.items;
  return adminJson(createListResponse(items, { ...options, params }));
}

async function handleDetail<T extends AdminEntity, TBody extends object>(
  context: AdminContext,
  options: CrudOptions<T, TBody>,
  request: Request,
  id: string,
): Promise<Response> {
  const instance = `/api/v1/admin/${options.resource}/${id}`;
  const denied = authorize(context, request, instance);
  if (denied) return denied;
  const scenario = await scenarioResponse(context, request, instance, "detail");
  if (scenario) return scenario;
  const item = options.items.find((candidate) => candidate.id === id);
  return item
    ? adminJson(structuredClone(item))
    : adminProblem("NOT_FOUND", instance);
}

function serverFields(
  context: AdminContext,
  options: { resource: string },
): ServerFields {
  const timestamp = new Date(context.now()).toISOString();
  return {
    id: `${options.resource}-${context.id()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function handleCreate<T extends AdminEntity, TBody extends object>(
  context: AdminContext,
  options: CrudOptions<T, TBody>,
  request: Request,
): Promise<Response> {
  const instance = `/api/v1/admin/${options.resource}`;
  const denied = authorize(context, request, instance);
  if (denied) return denied;
  const scenario = await scenarioResponse(
    context,
    request,
    instance,
    "mutation",
  );
  if (scenario) return scenario;
  if (!options.bodySchema || !options.build)
    return adminProblem("NOT_FOUND", instance);
  const body = await readBody(request, options.bodySchema);
  if (!body || options.validateBody?.(body) === false)
    return adminProblem("VALIDATION_ERROR", instance);
  const item = options.build(body, serverFields(context, options));
  options.items.push(item);
  return adminJson(structuredClone(item), 201);
}

async function handleUpdate<T extends AdminEntity, TBody extends object>(
  context: AdminContext,
  options: CrudOptions<T, TBody>,
  request: Request,
  id: string,
): Promise<Response> {
  const instance = `/api/v1/admin/${options.resource}/${id}`;
  const denied = authorize(context, request, instance);
  if (denied) return denied;
  const scenario = await scenarioResponse(
    context,
    request,
    instance,
    "mutation",
  );
  if (scenario) return scenario;
  const index = options.items.findIndex((candidate) => candidate.id === id);
  if (index < 0 || !options.bodySchema || !options.build)
    return adminProblem("NOT_FOUND", instance);
  const body = await readBody(request, options.bodySchema);
  if (!body || options.validateBody?.(body) === false)
    return adminProblem("VALIDATION_ERROR", instance);
  const current = options.items[index];
  const item = {
    ...current,
    ...options.build(body, {
      id,
      createdAt: current.createdAt,
      updatedAt: new Date(context.now()).toISOString(),
    }),
  };
  options.items[index] = item;
  return adminJson(structuredClone(item));
}

export function createCrudHandlers<T extends AdminEntity, TBody extends object>(
  context: AdminContext,
  options: CrudOptions<T, TBody>,
): HttpHandler[] {
  const collection = `/api/v1/admin/${options.resource}`;
  const detail = `${collection}/:id`;
  const handlers: HttpHandler[] = [
    http.get(collection, ({ request }) =>
      handleList(context, options, request),
    ),
    http.get(detail, ({ request, params }) =>
      handleDetail(context, options, request, String(params.id)),
    ),
  ];
  if (options.bodySchema)
    handlers.push(
      http.post(collection, ({ request }) =>
        handleCreate(context, options, request),
      ),
      http.put(detail, ({ request, params }) =>
        handleUpdate(context, options, request, String(params.id)),
      ),
    );
  return handlers;
}

function createCollections(): AdminCollections {
  return {
    organizations: adminOrganizations.map((item) => structuredClone(item)),
    staff: adminStaff.map((item) => structuredClone(item)),
    bookings: adminBookings.map((item) => structuredClone(item)),
    payments: adminPayments.map((item) => structuredClone(item)),
    refunds: adminRefunds.map((item) => structuredClone(item)),
  };
}

function baseOptions<T extends AdminEntity>(
  resource: string,
  items: T[],
): ReadOptions<T> {
  return {
    resource,
    items,
    matchesQuery: (item, query) =>
      JSON.stringify(item).toLowerCase().includes(query),
    getStatus: (item) => item.status,
    getOrganizationId: (item) =>
      "organizationId" in item ? item.organizationId : undefined,
  };
}

export function createAdminHandlers(
  options: {
    db?: MockDb;
    now?: () => number;
    id?: () => string;
    delay?: (milliseconds: number) => Promise<void>;
    allowScenarios?: boolean;
  } = {},
): HttpHandler[] {
  const data = createCollections();
  const memberships: Membership[] = data.staff.flatMap((staff) =>
    staff.role && staff.role !== "PLATFORM_SUPPORT"
      ? [
          {
            staffId: staff.id,
            organizationId: staff.organizationId,
            role: staff.role,
            status: staff.status,
            reason: "Dữ liệu mô phỏng",
            memberSince: staff.memberSince ?? "2026-08-01",
          },
        ]
      : [],
  );
  const idempotency = new Map<string, { body: string; result: Membership }>();
  const context: AdminContext = {
    db: options.db ?? mockDb,
    now: options.now ?? Date.now,
    id: options.id ?? (() => crypto.randomUUID()),
    delay:
      options.delay ??
      ((milliseconds) =>
        new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds))),
    allowScenarios:
      options.allowScenarios ??
      (!import.meta.env.PROD &&
        (import.meta.env.DEV || import.meta.env.MODE === "test")),
  };
  const bookingOrganization = new Map(
    data.bookings.map((item) => [item.id, item.organizationId]),
  );
  const organizationOptions: CrudOptions<
    Organization,
    z.infer<typeof organizationBodySchema>
  > = {
    ...baseOptions("organizations", data.organizations),
    bodySchema: organizationBodySchema,
    build: (body, fields) => ({ ...body, ...fields }),
    getOrganizationId: (item: Organization) => item.id,
    includeInList: (item) =>
      !["org-blue-demo", "org-sunrise-demo", "org-river-demo"].includes(
        item.id,
      ),
  };
  const staffOptions: CrudOptions<Staff, z.infer<typeof staffBodySchema>> = {
    ...baseOptions("staff", data.staff),
    bodySchema: staffBodySchema,
    build: (body, fields) => ({ ...body, ...fields }),
    includeInList: (item) =>
      item.role !== "PLATFORM_SUPPORT" &&
      ![
        "staff-blue-01",
        "staff-blue-02",
        "staff-sunrise-01",
        "staff-river-01",
      ].includes(item.id),
    validateBody: (body: z.infer<typeof staffBodySchema>) =>
      body.role === "PLATFORM_SUPPORT"
        ? body.organizationId === "platform-blue"
        : data.organizations.some((item) => item.id === body.organizationId),
  };
  return [
    http.get("/api/v1/admin/memberships", ({ request }) => {
      const denied = authorize(context, request, "/api/v1/admin/memberships");
      if (denied) return denied;
      const url = new URL(request.url);
      const organizationId = url.searchParams.get("organizationId");
      const staffId = url.searchParams.get("staffId");
      return adminJson(
        memberships.filter(
          (member) =>
            (!organizationId || member.organizationId === organizationId) &&
            (!staffId || member.staffId === staffId),
        ),
      );
    }),
    http.post("/api/v1/admin/memberships", async ({ request }) => {
      const denied = authorize(context, request, "/api/v1/admin/memberships");
      if (denied) return denied;
      const key = request.headers.get("Idempotency-Key");
      const body = await readBody(request, membershipInputSchema);
      if (
        !key ||
        !body ||
        !data.staff.some((item) => item.id === body.staffId) ||
        !data.organizations.some((item) => item.id === body.organizationId)
      )
        return adminProblem("VALIDATION_ERROR", "/api/v1/admin/memberships");
      const serialized = JSON.stringify(body);
      const previous = idempotency.get(key);
      if (previous)
        return previous.body === serialized
          ? adminJson(previous.result, 201)
          : adminProblem("VALIDATION_ERROR", "/api/v1/admin/memberships");
      if (
        memberships.some(
          (item) =>
            item.staffId === body.staffId &&
            item.organizationId === body.organizationId,
        )
      )
        return adminProblem("VALIDATION_ERROR", "/api/v1/admin/memberships");
      const result: Membership = {
        ...body,
        memberSince: new Date(context.now()).toISOString().slice(0, 10),
      };
      memberships.push(result);
      idempotency.set(key, { body: serialized, result });
      return adminJson(result, 201);
    }),
    http.put(
      "/api/v1/admin/memberships/:organizationId/:staffId",
      async ({ request, params }) => {
        const denied = authorize(context, request, "/api/v1/admin/memberships");
        if (denied) return denied;
        const body = await readBody(request, membershipInputSchema);
        const index = memberships.findIndex(
          (item) =>
            item.organizationId === params.organizationId &&
            item.staffId === params.staffId,
        );
        if (index < 0)
          return adminProblem("NOT_FOUND", "/api/v1/admin/memberships");
        if (
          !body ||
          body.organizationId !== params.organizationId ||
          body.staffId !== params.staffId
        )
          return adminProblem("VALIDATION_ERROR", "/api/v1/admin/memberships");
        const result = { ...body, memberSince: memberships[index].memberSince };
        memberships[index] = result;
        const staff = data.staff.find(
          (item) =>
            item.id === body.staffId &&
            item.organizationId === body.organizationId,
        );
        if (staff) staff.role = body.role;
        return adminJson(result);
      },
    ),
    ...createCrudHandlers(context, organizationOptions),
    ...createCrudHandlers(context, staffOptions),
    ...createCrudHandlers(context, {
      ...baseOptions("bookings", data.bookings),
      includeInList: (item) => !item.id.startsWith("admin-booking-"),
    }),
    ...createCrudHandlers(context, {
      ...baseOptions("payments", data.payments),
      includeInList: (item) => !item.id.startsWith("admin-payment-"),
      getOrganizationId: (item) => bookingOrganization.get(item.bookingId),
    }),
    ...createCrudHandlers(context, {
      ...baseOptions("refunds", data.refunds),
      includeInList: (item) => !item.id.startsWith("admin-refund-"),
      getOrganizationId: (item) => bookingOrganization.get(item.bookingId),
    }),
  ];
}

export const adminHandlers = createAdminHandlers();
