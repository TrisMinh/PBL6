import { apiFetch as fetch } from "@/shared/api/client";
import type { z } from "zod";
import { z as zod } from "zod";

import { MOCK_SESSION_HEADER } from "@/features/auth/config/session";
import { sessionTokenSchema } from "@/features/auth/schemas/session.schema";
import type { AdminListParams } from "@/features/admin/schemas/adminListParams.schema";
import { adminListParamsSchema } from "@/features/admin/schemas/adminListParams.schema";
import {
  adminBookingSchema,
  adminIdSchema,
  adminPaymentSchema,
  adminRefundSchema,
  organizationInputSchema,
  organizationSchema,
  pagedResultSchema,
  staffInputSchema,
  staffSchema,
  membershipSchema,
  membershipInputSchema,
} from "@/features/admin/schemas/adminResponse.schema";
import type { Membership, MembershipInput } from "@/features/admin/types/admin";
import type {
  AdminAccess,
  AdminRepository,
} from "@/features/admin/repositories/adminRepository";
import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  signal?: AbortSignal;
  expectedStatus: 200 | 201;
  idempotencyKey?: string;
}

function invalidInput(): AdminRepositoryError {
  return new AdminRepositoryError("VALIDATION_ERROR", 400);
}

function parseId(id: string): string {
  const parsed = adminIdSchema.safeParse(id);
  if (!parsed.success) throw invalidInput();
  return parsed.data;
}

function listQuery(params: AdminListParams): string {
  const parsed = adminListParamsSchema.safeParse({
    ...(params.query === undefined ? {} : { query: params.query }),
    ...(params.status === undefined ? {} : { status: params.status }),
    ...(params.organizationId === undefined
      ? {}
      : { organizationId: params.organizationId }),
    page: params.page,
    pageSize: params.pageSize,
  });
  if (!parsed.success) throw invalidInput();
  const query = new URLSearchParams();
  if (parsed.data.query) query.set("query", parsed.data.query);
  if (parsed.data.status) query.set("status", parsed.data.status);
  if (parsed.data.organizationId)
    query.set("organizationId", parsed.data.organizationId);
  query.set("page", String(parsed.data.page));
  query.set("pageSize", String(parsed.data.pageSize));
  return query.toString();
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw invalidInput();
  return parsed.data;
}

async function sendAdmin(
  path: string,
  access: AdminAccess,
  options: RequestOptions,
): Promise<Response> {
  const token = sessionTokenSchema.safeParse(access.sessionToken);
  if (!token.success) throw invalidInput();
  try {
    return await fetch(path, {
      method: options.method ?? "GET",
      signal: options.signal,
      headers: {
        [MOCK_SESSION_HEADER]: token.data,
        ...(options.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : {}),
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new AdminRepositoryError(
      options.signal?.aborted ? "ABORTED" : "NETWORK_ERROR",
    );
  }
}

export function createMembershipRepository(access: AdminAccess): {
  list: (
    filters: { organizationId?: string; staffId?: string },
    signal?: AbortSignal,
  ) => Promise<Membership[]>;
  create: (input: MembershipInput, key: string) => Promise<Membership>;
  update: (input: MembershipInput) => Promise<Membership>;
} {
  return {
    list: (filters, signal) => {
      const params = new URLSearchParams();
      if (filters.organizationId)
        params.set("organizationId", parseId(filters.organizationId));
      if (filters.staffId) params.set("staffId", parseId(filters.staffId));
      return requestAdmin(
        `/api/v1/admin/memberships?${params}`,
        zod.array(membershipSchema),
        access,
        { expectedStatus: 200, signal },
      );
    },
    create: (input, key) =>
      requestAdmin("/api/v1/admin/memberships", membershipSchema, access, {
        method: "POST",
        body: parseInput(membershipInputSchema, input),
        idempotencyKey: key,
        expectedStatus: 201,
      }),
    update: (input) =>
      requestAdmin(
        `/api/v1/admin/memberships/${encodeURIComponent(parseId(input.organizationId))}/${encodeURIComponent(parseId(input.staffId))}`,
        membershipSchema,
        access,
        {
          method: "PUT",
          body: parseInput(membershipInputSchema, input),
          expectedStatus: 200,
        },
      ),
  };
}

async function parseAdminResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
  options: RequestOptions,
): Promise<T> {
  if (!response.ok)
    throw new AdminRepositoryError("HTTP_ERROR", response.status);
  if (response.status !== options.expectedStatus)
    throw new AdminRepositoryError("INVALID_RESPONSE", response.status);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AdminRepositoryError(
      options.signal?.aborted ? "ABORTED" : "INVALID_RESPONSE",
      options.signal?.aborted ? 0 : response.status,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new AdminRepositoryError("INVALID_RESPONSE", response.status);
  return parsed.data;
}

async function requestAdmin<T>(
  path: string,
  schema: z.ZodType<T>,
  access: AdminAccess,
  options: RequestOptions,
): Promise<T> {
  const response = await sendAdmin(path, access, options);
  return parseAdminResponse(response, schema, options);
}

async function listResource<T>(
  access: AdminAccess,
  resource: string,
  params: AdminListParams,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  return requestAdmin(
    `/api/v1/admin/${resource}?${listQuery(params)}`,
    schema,
    access,
    { expectedStatus: 200, signal },
  );
}

async function detailResource<T>(
  access: AdminAccess,
  resource: string,
  id: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  return requestAdmin(
    `/api/v1/admin/${resource}/${encodeURIComponent(parseId(id))}`,
    schema,
    access,
    { expectedStatus: 200, signal },
  );
}

async function mutateResource<TInput, TOutput>(
  access: AdminAccess,
  resource: string,
  id: string | null,
  input: TInput,
  inputSchema: z.ZodType<TInput>,
  outputSchema: z.ZodType<TOutput>,
  signal?: AbortSignal,
): Promise<TOutput> {
  const body = parseInput(inputSchema, input);
  const path =
    id === null
      ? `/api/v1/admin/${resource}`
      : `/api/v1/admin/${resource}/${encodeURIComponent(parseId(id))}`;
  return requestAdmin(path, outputSchema, access, {
    method: id === null ? "POST" : "PUT",
    body,
    expectedStatus: id === null ? 201 : 200,
    signal,
  });
}

type OrganizationMethods = Pick<
  AdminRepository,
  | "listOrganizations"
  | "getOrganization"
  | "createOrganization"
  | "updateOrganization"
>;

function organizationMethods(access: AdminAccess): OrganizationMethods {
  const listSchema = pagedResultSchema(organizationSchema);
  return {
    listOrganizations: (params, signal) =>
      listResource(access, "organizations", params, listSchema, signal),
    getOrganization: (id, signal) =>
      detailResource(access, "organizations", id, organizationSchema, signal),
    createOrganization: (input, signal) =>
      mutateResource(
        access,
        "organizations",
        null,
        input,
        organizationInputSchema,
        organizationSchema,
        signal,
      ),
    updateOrganization: (id, input, signal) =>
      mutateResource(
        access,
        "organizations",
        id,
        input,
        organizationInputSchema,
        organizationSchema,
        signal,
      ),
  };
}

type StaffMethods = Pick<
  AdminRepository,
  "listStaff" | "getStaff" | "createStaff" | "updateStaff"
>;

function staffMethods(access: AdminAccess): StaffMethods {
  const listSchema = pagedResultSchema(staffSchema);
  return {
    listStaff: (params, signal) =>
      listResource(access, "staff", params, listSchema, signal),
    getStaff: (id, signal) =>
      detailResource(access, "staff", id, staffSchema, signal),
    createStaff: (input, signal) =>
      mutateResource(
        access,
        "staff",
        null,
        input,
        staffInputSchema,
        staffSchema,
        signal,
      ),
    updateStaff: (id, input, signal) =>
      mutateResource(
        access,
        "staff",
        id,
        input,
        staffInputSchema,
        staffSchema,
        signal,
      ),
  };
}

type TransactionMethods = Pick<
  AdminRepository,
  | "listBookings"
  | "getBooking"
  | "listPayments"
  | "getPayment"
  | "listRefunds"
  | "getRefund"
>;

function transactionMethods(access: AdminAccess): TransactionMethods {
  return {
    listBookings: (params, signal) =>
      listResource(
        access,
        "bookings",
        params,
        pagedResultSchema(adminBookingSchema),
        signal,
      ),
    getBooking: (id, signal) =>
      detailResource(access, "bookings", id, adminBookingSchema, signal),
    listPayments: (params, signal) =>
      listResource(
        access,
        "payments",
        params,
        pagedResultSchema(adminPaymentSchema),
        signal,
      ),
    getPayment: (id, signal) =>
      detailResource(access, "payments", id, adminPaymentSchema, signal),
    listRefunds: (params, signal) =>
      listResource(
        access,
        "refunds",
        params,
        pagedResultSchema(adminRefundSchema),
        signal,
      ),
    getRefund: (id, signal) =>
      detailResource(access, "refunds", id, adminRefundSchema, signal),
  };
}

export function createHttpAdminRepository(
  access: AdminAccess,
): AdminRepository {
  return {
    ...organizationMethods(access),
    ...staffMethods(access),
    ...transactionMethods(access),
  };
}
