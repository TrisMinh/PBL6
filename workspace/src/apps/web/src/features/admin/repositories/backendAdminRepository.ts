import { z } from "zod";
import { liveApiJson } from "@/shared/api/liveRequest";
import type { AdminRepository } from "./adminRepository";
import { AdminRepositoryError } from "./adminRepositoryError";
import type { AdminListParams } from "../schemas/adminListParams.schema";
import type {
  Organization,
  Staff,
  AdminBooking,
  AdminPayment,
  AdminRefund,
  Membership,
  MembershipInput,
} from "../types/admin";
import type { PagedResult } from "../types/pagination";

type Row = Record<string, unknown>;
const text = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const object = (v: unknown): Row =>
  v && typeof v === "object" ? (v as Row) : {};
const array = (v: unknown): Row[] => (Array.isArray(v) ? v.map(object) : []);
const active = (v: unknown): "active" | "inactive" =>
  v === "ACTIVE" ? "active" : "inactive";
async function request(
  path: string,
  options: Parameters<typeof liveApiJson>[2] = {},
): Promise<Row> {
  try {
    return object(await liveApiJson(path, z.unknown(), options));
  } catch (error) {
    throw new AdminRepositoryError(
      "HTTP_ERROR",
      num(object(error).status) || 500,
    );
  }
}
async function rows(path: string, signal?: AbortSignal): Promise<Row[]> {
  const result = await liveApiJson(path, z.unknown(), { signal });
  return array(result);
}
async function all(path: string, signal?: AbortSignal): Promise<Row[]> {
  const result: Row[] = [];
  for (let page = 0; ; page++) {
    const body = await request(`${path}?page=${page}&size=100`, { signal });
    result.push(...array(body.items));
    if (page + 1 >= num(body.totalPages)) return result;
  }
}
function paged<T extends { id: string; status: string }>(
  items: T[],
  params: AdminListParams,
): PagedResult<T> {
  const query = params.query?.trim().toLocaleLowerCase("vi");
  const filtered = items.filter(
    (item) =>
      (!params.status || item.status === params.status) &&
      (!params.organizationId ||
        text(object(item).organizationId) === params.organizationId) &&
      (!query || JSON.stringify(item).toLocaleLowerCase("vi").includes(query)),
  );
  return {
    items: filtered.slice(
      (params.page - 1) * params.pageSize,
      params.page * params.pageSize,
    ),
    total: filtered.length,
    page: params.page,
    pageSize: params.pageSize,
  };
}
function organization(value: Row): Organization {
  return {
    id: text(value.id),
    name: text(value.name),
    contactEmail: text(value.contactEmail),
    contactPhone: text(value.contactPhone),
    status: active(value.status),
    contactName: text(value.contactName) || undefined,
    legalName: text(value.legalName) || undefined,
    taxId: text(value.taxId) || undefined,
    address: text(value.address) || undefined,
    createdAt: text(value.createdAt),
    updatedAt: text(value.updatedAt),
  };
}
function staff(value: Row): Staff {
  const membership = array(value.organizationMemberships)[0];
  const roles = (membership?.roleCodes ?? value.roles) as string[] | undefined;
  const role = roles?.find((r) =>
    [
      "OPERATOR_ADMIN",
      "OPERATOR_SCHEDULER",
      "DRIVER",
      "PLATFORM_SUPPORT",
    ].includes(r),
  ) as Staff["role"];
  return {
    id: text(value.id),
    fullName: text(value.fullName),
    email: text(value.email),
    phone: text(value.phone),
    organizationId: text(membership?.organizationId),
    status: active(value.status),
    role,
    createdAt: text(value.createdAt),
    updatedAt: text(value.updatedAt),
    memberSince: text(membership?.createdAt).slice(0, 10) || undefined,
  };
}
function membership(value: Row): Membership {
  return {
    staffId: text(value.userId),
    organizationId: text(value.organizationId),
    role: (value.roleCodes as Membership["role"][])?.[0],
    status: active(value.status),
    reason: text(value.reason),
    memberSince: text(value.createdAt).slice(0, 10),
  };
}
export function createBackendMembershipRepository(): ReturnType<
  typeof import("./httpAdminRepository").createMembershipRepository
> {
  async function list(
    filters: { organizationId?: string; staffId?: string },
    signal?: AbortSignal,
  ): Promise<Membership[]> {
    if (filters.organizationId)
      return (
        await rows(
          `/api/v1/admin/organizations/${encodeURIComponent(filters.organizationId)}/members`,
          signal,
        )
      )
        .filter((v) => !filters.staffId || v.userId === filters.staffId)
        .map(membership);
    if (filters.staffId)
      return array(
        (
          await request(
            `/api/v1/admin/users/${encodeURIComponent(filters.staffId)}`,
            { signal },
          )
        ).organizationMemberships,
      ).map(membership);
    const orgs = await rows("/api/v1/admin/organizations", signal);
    return (
      await Promise.all(
        orgs.map((org) =>
          rows(
            `/api/v1/admin/organizations/${encodeURIComponent(text(org.id))}/members`,
            signal,
          ),
        ),
      )
    )
      .flat()
      .map(membership);
  }
  async function save(
    input: MembershipInput,
    key?: string,
  ): Promise<Membership> {
    const endpoint = `/api/v1/admin/organizations/${encodeURIComponent(input.organizationId)}/members`;
    const existing = key
      ? undefined
      : (await rows(endpoint)).find((v) => v.userId === input.staffId);
    const result = await request(
      existing
        ? `${endpoint}/${encodeURIComponent(text(existing.id))}`
        : endpoint,
      {
        method: existing ? "PATCH" : "POST",
        idempotent: !existing,
        body: {
          userId: input.staffId,
          roleCodes: [input.role],
          status: input.status.toUpperCase(),
          reason: input.reason,
          expectedVersion: num(existing?.rowVersion),
        },
      },
    );
    return membership(result);
  }
  return {
    list,
    create: (input: MembershipInput, key: string) => save(input, key),
    update: (input: MembershipInput) => save(input),
  };
}
export function createBackendAdminRepository(): AdminRepository {
  async function getOrganization(
    id: string,
    signal?: AbortSignal,
  ): Promise<Organization> {
    return organization(
      await request(
        `/api/v1/admin/organizations/${encodeURIComponent(id)}/profile`,
        { signal },
      ),
    );
  }
  async function booking(
    value: Row,
    signal?: AbortSignal,
  ): Promise<AdminBooking> {
    const trip = value.tripId
      ? await request(
          `/api/v1/trips/${encodeURIComponent(text(value.tripId))}`,
          { signal },
        )
      : {};
    return {
      id: text(value.id),
      bookingCode: text(value.code),
      organizationId: text(value.organizationId) || text(trip.organizationId),
      customerName: text(object(value.contact).fullName),
      routeLabel:
        trip.origin && trip.destination
          ? `${text(trip.origin)} → ${text(trip.destination)}`
          : "—",
      passengerCount: array(value.items).length,
      totalVnd: num(value.total),
      status:
        value.status === "CONFIRMED" || value.status === "PAID"
          ? "paid"
          : ["CANCELLED", "EXPIRED"].includes(text(value.status))
            ? "cancelled"
            : "pending-payment",
      createdAt: text(value.createdAt),
      updatedAt: text(value.updatedAt),
    };
  }
  function payment(value: Row): AdminPayment {
    return {
      id: text(value.id),
      bookingId: text(value.bookingId),
      transactionCode: text(value.providerTransactionId) || text(value.id),
      amountVnd: num(value.amount),
      status:
        value.status === "SUCCEEDED"
          ? "success"
          : value.status === "FAILED"
            ? "failed"
            : value.status === "CANCELLED"
              ? "cancelled"
              : "pending",
      createdAt: text(value.createdAt),
      updatedAt: text(value.updatedAt),
    };
  }
  function refund(value: Row): AdminRefund {
    return {
      id: text(value.id),
      bookingId: text(value.bookingId),
      paymentId: text(value.paymentId),
      amountVnd: num(value.amount),
      status:
        value.status === "SUCCEEDED" || value.status === "COMPLETED"
          ? "completed"
          : value.status === "FAILED"
            ? "failed"
            : "processing",
      createdAt: text(value.createdAt),
      updatedAt: text(value.updatedAt),
    };
  }
  async function saveStaff(
    id: string | undefined,
    input: Parameters<AdminRepository["createStaff"]>[0],
    signal?: AbortSignal,
  ): Promise<Staff> {
    const existing = id
      ? await request(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
          signal,
        })
      : undefined;
    const value = await request(
      `/api/v1/admin/users${id ? `/${encodeURIComponent(id)}` : ""}`,
      {
        method: id ? "PATCH" : "POST",
        idempotent: !id,
        signal,
        body: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          expectedVersion: num(existing?.rowVersion),
        },
      },
    );
    let current = value;
    if (id && active(current.status) !== input.status)
      current = await request(
        `/api/v1/admin/users/${encodeURIComponent(text(value.id))}/status`,
        {
          method: "PATCH",
          body: {
            status: input.status === "active" ? "ACTIVE" : "DISABLED",
            reason: input.membershipReason || "Cập nhật hồ sơ nhân sự",
            expectedVersion: num(current.rowVersion),
          },
        },
      );
    if (input.organizationId && input.role && input.role !== "PLATFORM_SUPPORT")
      await createBackendMembershipRepository().update({
        staffId: text(value.id),
        organizationId: input.organizationId,
        role: input.role,
        status: input.status,
        reason: input.membershipReason || "Cập nhật hồ sơ nhân sự",
      });
    else if (input.role === "PLATFORM_SUPPORT")
      await request(
        `/api/v1/admin/users/${encodeURIComponent(text(value.id))}/roles`,
        {
          method: "PUT",
          body: {
            roleCodes: ["PLATFORM_SUPPORT"],
            reason: input.membershipReason || "Cập nhật hồ sơ nhân sự",
            expectedVersion: num(current.rowVersion),
          },
        },
      );
    return staff(
      await request(
        `/api/v1/admin/users/${encodeURIComponent(text(value.id))}`,
        { signal },
      ),
    );
  }
  return {
    listOrganizations: async (params, signal) =>
      paged(
        (await rows("/api/v1/admin/organizations", signal)).map(organization),
        params,
      ),
    getOrganization,
    createOrganization: async (input, signal) => {
      const created = await request("/api/v1/admin/organizations", {
        method: "POST",
        idempotent: true,
        signal,
        body: {
          name: input.name,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          expectedVersion: 0,
        },
      });
      await request(
        `/api/v1/admin/organizations/${encodeURIComponent(text(created.id))}/profile`,
        {
          method: "PATCH",
          signal,
          body: { ...input, expectedVersion: num(created.rowVersion) },
        },
      );
      return getOrganization(text(created.id), signal);
    },
    updateOrganization: async (id, input, signal) => {
      const current = await request(
        `/api/v1/admin/organizations/${encodeURIComponent(id)}`,
        { signal },
      );
      return organization(
        await request(
          `/api/v1/admin/organizations/${encodeURIComponent(id)}/profile`,
          {
            method: "PATCH",
            signal,
            body: { ...input, expectedVersion: num(current.rowVersion) },
          },
        ),
      );
    },
    listStaff: async (params, signal) =>
      paged(
        (await all("/api/v1/admin/users", signal))
          .map(staff)
          .filter((user) => !!user.role),
        params,
      ),
    getStaff: async (id, signal) =>
      staff(
        await request(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
          signal,
        }),
      ),
    createStaff: (input, signal) => saveStaff(undefined, input, signal),
    updateStaff: (id, input, signal) => saveStaff(id, input, signal),
    listBookings: async (params, signal) =>
      paged(
        await Promise.all(
          (await all("/api/v1/admin/bookings", signal)).map((value) =>
            booking(value, signal),
          ),
        ),
        params,
      ),
    getBooking: async (id, signal) =>
      booking(
        await request(`/api/v1/bookings/${encodeURIComponent(id)}`, { signal }),
        signal,
      ),
    listPayments: async (params, signal) =>
      paged((await all("/api/v1/admin/payments", signal)).map(payment), params),
    getPayment: async (id, signal) =>
      payment(
        await request(`/api/v1/payments/${encodeURIComponent(id)}`, { signal }),
      ),
    listRefunds: async (params, signal) =>
      paged((await all("/api/v1/admin/refunds", signal)).map(refund), params),
    getRefund: async (id, signal) =>
      refund(
        await request(`/api/v1/refunds/${encodeURIComponent(id)}`, { signal }),
      ),
  };
}
