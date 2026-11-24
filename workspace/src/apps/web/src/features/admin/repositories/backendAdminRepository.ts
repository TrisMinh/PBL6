import { createBackendTransactionRepository } from "./backendTransactionRepository";
import { z } from "zod";
import { liveApiJson } from "@/shared/api/liveRequest";
import { readApiSession } from "@/shared/api/session";
import type { AdminRepository } from "./adminRepository";
import { AdminRepositoryError } from "./adminRepositoryError";
import type { AdminListParams } from "../schemas/adminListParams.schema";
import type {
  Organization,
  Staff,
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
const staffRoles = [
  "OPERATOR_ADMIN",
  "OPERATOR_SCHEDULER",
  "DRIVER",
  "PLATFORM_SUPPORT",
];
const membershipFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function membershipDate(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return "";
  const parts = membershipFormatter.formatToParts(new Date(value));
  const part = (name: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
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
    statusCounts: filtered.reduce<Record<string, number>>((counts, item) => {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
      return counts;
    }, {}),
    page: params.page,
    pageSize: params.pageSize,
  };
}
function organization(value: Row): Organization {
  return {
    id: text(value.id),
    code: text(value.code) || undefined,
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
function staff(value: Row, organizationId?: string): Staff {
  const memberships = array(value.organizationMemberships);
  const selected =
    memberships.find((item) => item.organizationId === organizationId) ??
    memberships.find(
      (item) =>
        Array.isArray(item.roleCodes) &&
        item.roleCodes.some((role) => staffRoles.includes(role)),
    ) ??
    memberships[0];
  const roles = (selected?.roleCodes ?? []) as string[];
  const role = (roles.find((r) => staffRoles.includes(r)) ??
    (!organizationId &&
    Array.isArray(value.roles) &&
    value.roles.includes("PLATFORM_SUPPORT")
      ? "PLATFORM_SUPPORT"
      : undefined)) as Staff["role"];
  return {
    id: text(value.id),
    fullName: text(value.fullName),
    email: text(value.email),
    phone: text(value.phone),
    organizationId: text(selected?.organizationId),
    status: active(value.status),
    role,
    createdAt: text(value.createdAt),
    updatedAt: text(value.updatedAt),
    memberSince: membershipDate(selected?.createdAt) || undefined,
    memberships: memberships.map(membership),
    accountStatus: text(value.status),
  };
}
function membership(value: Row): Membership {
  return {
    staffId: text(value.userId),
    organizationId: text(value.organizationId),
    role: (value.roleCodes as Membership["role"][])?.[0],
    status: active(value.status),
    reason: text(value.reason),
    memberSince: membershipDate(value.createdAt),
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
    const existing = (await rows(endpoint)).find(
      (v) =>
        v.userId === input.staffId && v.organizationId === input.organizationId,
    );
    const result = await request(
      existing
        ? `${endpoint}/${encodeURIComponent(text(existing.id))}`
        : endpoint,
      {
        method: existing ? "PATCH" : "POST",
        idempotent: !existing && !key,
        idempotencyKey: !existing ? key : undefined,
        body: {
          userId: input.staffId,
          roleCodes: [input.role],
          status: input.status === "active" ? "ACTIVE" : "SUSPENDED",
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
    if (active(current.status) !== input.status)
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
            roleCodes: [
              ...new Set([
                ...(Array.isArray(current.roles)
                  ? current.roles.filter(
                      (role): role is string => typeof role === "string",
                    )
                  : []),
                "PLATFORM_SUPPORT",
              ]),
            ],
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
      const fingerprint = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify([readApiSession()?.user.id, input]),
        ),
      );
      const digest = Array.from(new Uint8Array(fingerprint), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const storageKey = `blue-live-organization:${digest}`;
      const key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
      const created = await request("/api/v1/admin/organizations", {
        method: "POST",
        idempotencyKey: key,
        signal,
        body: {
          code: `ORG-${key}`,
          name: input.name,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          expectedVersion: 0,
        },
      });
      const profilePath = `/api/v1/admin/organizations/${encodeURIComponent(text(created.id))}/profile`;
      const current = await request(profilePath, { signal });
      const saved = await request(profilePath, {
        method: "PATCH",
        signal,
        body: { ...input, expectedVersion: num(current.rowVersion) },
      });
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* A retained key safely replays the creation. */
      }
      return organization(saved);
    },
    updateOrganization: async (id, input, signal) => {
      const current = await request(
        `/api/v1/admin/organizations/${encodeURIComponent(id)}/profile`,
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
    listStaff: (params, signal) =>
      listUserPage(params, signal, { staffOnly: true }),
    getStaff: async (id, signal) =>
      staff(
        await request(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
          signal,
        }),
      ),
    createStaff: (input, signal) => saveStaff(undefined, input, signal),
    updateStaff: (id, input, signal) => saveStaff(id, input, signal),
    ...createBackendTransactionRepository(),
  };
}

export async function listUserPage(
  params: AdminListParams,
  signal?: AbortSignal,
  filters: { staffOnly?: boolean; membershipActive?: boolean } = {},
): Promise<PagedResult<Staff>> {
  const query = new URLSearchParams({
    page: String(params.page - 1),
    size: String(params.pageSize),
  });
  if (params.organizationId) query.set("organizationId", params.organizationId);
  if (params.query?.trim()) query.set("search", params.query.trim());
  if (filters.staffOnly) query.set("staffOnly", "true");
  if (params.status === "active" || params.status === "inactive")
    query.set("active", String(params.status === "active"));
  if (filters.membershipActive !== undefined)
    query.set("membershipActive", String(filters.membershipActive));
  const result = await request(`/api/v1/admin/users?${query}`, { signal });
  return {
    items: array(result.items).map((value) =>
      staff(value, params.organizationId),
    ),
    total: num(result.totalElements),
    page: params.page,
    pageSize: params.pageSize,
  };
}

export function listBackendStaffCandidates(
  signal?: AbortSignal,
  filters: { organizationId?: string; search?: string } = {},
): Promise<Staff[]> {
  const search = filters.search?.trim();
  if (!search || search.length < 2) return Promise.resolve([]);
  return listUserPage(
    {
      page: 1,
      pageSize: 50,
      organizationId: filters.organizationId,
      query: search,
    },
    signal,
  ).then((result) => result.items);
}

export async function updateBackendStaffStatus(
  id: string,
  status: "active" | "inactive",
): Promise<Staff> {
  const current = await request(`/api/v1/admin/users/${id}`);
  return staff(
    await request(`/api/v1/admin/users/${id}/status`, {
      method: "PATCH",
      body: {
        status: status === "active" ? "ACTIVE" : "DISABLED",
        reason: "Quản trị viên cập nhật trạng thái tài khoản",
        expectedVersion: num(current.rowVersion),
      },
    }),
  );
}
