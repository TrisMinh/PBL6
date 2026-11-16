import { stateLabel } from "@/shared/api/livePresentation";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { getLiveRows, liveApiJson } from "@/shared/api/liveRequest";
import { ApiError } from "@/shared/api/error";
import type { AdminRepository } from "./adminRepository";
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
const rowSchema = z.record(z.string(), z.unknown());
type Row = z.infer<typeof rowSchema>;
const text = (r: Row, k: string): string =>
  typeof r[k] === "string" ? String(r[k]) : "";
const number = (r: Row, k: string): number =>
  typeof r[k] === "number" ? Number(r[k]) : 0;
const objects = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((v): v is Row => typeof v === "object" && v !== null)
    : [];
function org(r: Row): Organization {
  return {
    code: text(r, "code"),
    id: text(r, "id"),
    name: text(r, "name"),
    contactEmail: text(r, "contactEmail"),
    contactPhone: text(r, "contactPhone"),
    status: r.status === "ACTIVE" ? "active" : "inactive",
    createdAt: text(r, "createdAt"),
    updatedAt: text(r, "updatedAt"),
  };
}
function staff(r: Row): Staff {
  const membership = objects(r.organizationMemberships)[0];
  return {
    id: text(r, "id"),
    fullName: text(r, "fullName"),
    email: text(r, "email"),
    phone: text(r, "phone"),
    status: r.status === "ACTIVE" ? "active" : "inactive",
    organizationId: membership ? text(membership, "organizationId") : "",
    role:
      Array.isArray(r.roles) && r.roles.includes("PLATFORM_SUPPORT")
        ? "PLATFORM_SUPPORT"
        : membership &&
            Array.isArray(membership.roleCodes) &&
            membership.roleCodes.includes("OPERATOR_ADMIN")
          ? "OPERATOR_ADMIN"
          : membership &&
              Array.isArray(membership.roleCodes) &&
              membership.roleCodes.includes("DRIVER")
            ? "DRIVER"
            : "OPERATOR_SCHEDULER",
    createdAt: text(r, "createdAt"),
    updatedAt: text(r, "updatedAt") || text(r, "createdAt"),
  };
}
function booking(r: Row): AdminBooking {
  const contact =
    typeof r.contact === "object" && r.contact !== null
      ? (r.contact as Row)
      : {};
  return {
    id: text(r, "id"),
    bookingCode: text(r, "code"),
    organizationName: text(r, "organizationName"),
    organizationId: text(r, "organizationId"),
    customerName: text(contact, "fullName"),
    routeLabel: text(r, "routeName") || text(r, "tripId"),
    passengerCount: objects(r.items).length,
    totalVnd: number(r, "total"),
    status:
      r.status === "PAID" || r.status === "COMPLETED"
        ? "paid"
        : r.status === "PENDING_PAYMENT" || r.status === "CONFIRMED"
          ? "pending-payment"
          : "cancelled",
    rawStatus: text(r, "status"),
    createdAt: text(r, "createdAt"),
    updatedAt: text(r, "updatedAt"),
  };
}
function payment(r: Row): AdminPayment {
  return {
    provider: text(r, "provider"),
    organizationId: text(r, "organizationId"),
    id: text(r, "id"),
    bookingId: text(r, "bookingId"),
    transactionCode: text(r, "id"),
    amountVnd: number(r, "amount"),
    status:
      r.status === "SUCCEEDED"
        ? "success"
        : r.status === "FAILED"
          ? "failed"
          : r.status === "CANCELLED"
            ? "cancelled"
            : "pending",
    rawStatus: text(r, "status"),
    createdAt: text(r, "createdAt"),
    updatedAt: text(r, "updatedAt"),
  };
}
function refund(r: Row): AdminRefund {
  return {
    reason: text(r, "reason"),
    reference: text(r, "refundReference"),
    organizationId: text(r, "organizationId"),
    id: text(r, "id"),
    bookingId: text(r, "bookingId"),
    paymentId: text(r, "paymentId"),
    amountVnd: number(r, "amount"),
    status:
      r.status === "SUCCEEDED"
        ? "completed"
        : r.status === "FAILED"
          ? "failed"
          : "processing",
    rawStatus: text(r, "status"),
    createdAt: text(r, "createdAt"),
    updatedAt: text(r, "updatedAt"),
  };
}
async function list<T extends { status: string }>(
  resource: string,
  params: AdminListParams,
  map: (r: Row) => T,
  signal?: AbortSignal,
): Promise<PagedResult<T>> {
  let rows = await getLiveRows(`/api/v1/admin/${resource}`, signal);
  if (resource === "bookings") rows = await enrichBookings(rows, signal);
  else if (
    params.organizationId &&
    (resource === "payments" || resource === "refunds")
  ) {
    const bookings = await enrichBookings(
      await getLiveRows("/api/v1/admin/bookings", signal),
      signal,
    );
    const owners = new Map(bookings.map((b) => [b.id, b.organizationId]));
    rows = rows.map((r) => ({ ...r, organizationId: owners.get(r.bookingId) }));
  }
  const filtered = rows
    .map(map)
    .filter(
      (item) =>
        (!params.status || item.status === params.status) &&
        (!params.viewStatus ||
          item.status === params.viewStatus ||
          ("rawStatus" in item &&
            String(item.rawStatus).toLowerCase().replaceAll("_", "-") ===
              params.viewStatus)) &&
        (!params.organizationId ||
          ("organizationId" in item &&
            item.organizationId === params.organizationId)) &&
        (!params.query ||
          JSON.stringify(item)
            .toLocaleLowerCase("vi")
            .includes(params.query.toLocaleLowerCase("vi"))),
    );
  const start = (params.page - 1) * params.pageSize;
  return {
    items: filtered.slice(start, start + params.pageSize),
    page: params.page,
    pageSize: params.pageSize,
    total: filtered.length,
  };
}
async function detail<T>(
  path: string,
  id: string,
  map: (r: Row) => T,
  signal?: AbortSignal,
): Promise<T> {
  return map(
    await apiJson(`/api/v1/${path}/${encodeURIComponent(id)}`, rowSchema, {
      signal,
    }),
  );
}
function unsupported(): never {
  throw new ApiError(
    "FEATURE_UNAVAILABLE",
    501,
    "Thao tác này chưa được API hỗ trợ. Dữ liệu chưa được thay đổi.",
  );
}
export const backendAdminRepository: AdminRepository = {
  listOrganizations: (p, s) => list("organizations", p, org, s),
  getOrganization: (id, s) => detail("admin/organizations", id, org, s),
  createOrganization: async (input, signal) =>
    org(
      await apiJson("/api/v1/admin/organizations", rowSchema, {
        method: "POST",
        signal,
        idempotencyKey: crypto.randomUUID(),
        body: {
          name: input.name,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          allowPayLater: false,
          expectedVersion: 0,
        },
      }),
    ),
  updateOrganization: async () => unsupported(),
  listStaff: (p, s) => list("users", p, staff, s),
  getStaff: (id, s) => detail("admin/users", id, staff, s),
  createStaff: async () => unsupported(),
  updateStaff: async (id, input, signal) => {
    let row = await apiJson(
      `/api/v1/admin/users/${encodeURIComponent(id)}`,
      rowSchema,
      { signal },
    );
    if (
      input.fullName !== row.fullName ||
      input.email !== row.email ||
      input.phone !== row.phone
    )
      throw new ApiError(
        "FEATURE_UNAVAILABLE",
        501,
        "API hiện hỗ trợ trạng thái và vai trò; chưa hỗ trợ sửa thông tin cá nhân tại đây.",
      );
    const status = input.status === "active" ? "ACTIVE" : "SUSPENDED";
    if (status !== row.status)
      row = await liveApiJson(
        `/api/v1/admin/users/${encodeURIComponent(id)}/status`,
        rowSchema,
        {
          method: "PATCH",
          signal,
          idempotent: true,
          body: {
            status,
            reason:
              input.membershipReason || "Cập nhật trạng thái từ trang quản trị",
            expectedVersion: row.rowVersion,
          },
        },
      );
    if (
      input.role === "PLATFORM_SUPPORT" &&
      !(Array.isArray(row.roles) && row.roles.includes("PLATFORM_SUPPORT"))
    )
      row = await liveApiJson(
        `/api/v1/admin/users/${encodeURIComponent(id)}/roles`,
        rowSchema,
        {
          method: "PUT",
          signal,
          idempotent: true,
          body: {
            roleCodes: [
              ...(Array.isArray(row.roles) ? row.roles : []),
              "PLATFORM_SUPPORT",
            ],
            reason: input.membershipReason,
            expectedVersion: row.rowVersion,
          },
        },
      );
    return staff(row);
  },
  listBookings: (p, s) => list("bookings", p, booking, s),
  getBooking: async (id, signal) => {
    const result = booking(
      (
        await enrichBookings(
          [
            await apiJson(
              `/api/v1/bookings/${encodeURIComponent(id)}`,
              rowSchema,
              { signal },
            ),
          ],
          signal,
        )
      )[0],
    );
    const [payments, refunds, tickets] = await Promise.all([
      apiJson(`/api/v1/bookings/${id}/payments`, z.array(rowSchema), {
        signal,
      }),
      getLiveRows("/api/v1/admin/refunds", signal),
      apiJson(`/api/v1/bookings/${id}/tickets`, z.array(rowSchema), { signal }),
    ]);
    result.relatedPayments = payments.map((r) => ({
      id: text(r, "id"),
      status: text(r, "status"),
      amount: number(r, "amount"),
    }));
    result.relatedRefunds = refunds
      .filter((r) => r.bookingId === id)
      .map((r) => ({
        id: text(r, "id"),
        status: text(r, "status"),
        amount: number(r, "amount"),
      }));
    result.ticketStatusLabel = tickets.length
      ? tickets
          .map(
            (t) => `${text(t, "seatCode")} · ${stateLabel(text(t, "status"))}`,
          )
          .join(", ")
      : "Chưa phát hành";
    return result;
  },
  listPayments: (p, s) => list("payments", p, payment, s),
  getPayment: (id, s) => detail("payments", id, payment, s),
  listRefunds: (p, s) => list("refunds", p, refund, s),
  getRefund: (id, s) => detail("refunds", id, refund, s),
};

function membership(row: Row): Membership {
  const roles = Array.isArray(row.roleCodes) ? row.roleCodes : [];
  const role = roles.includes("OPERATOR_ADMIN")
    ? "OPERATOR_ADMIN"
    : roles.includes("DRIVER")
      ? "DRIVER"
      : "OPERATOR_SCHEDULER";
  return {
    staffId: text(row, "userId"),
    organizationId: text(row, "organizationId"),
    role,
    status: row.status === "ACTIVE" ? "active" : "inactive",
    reason: "",
    memberSince: "",
  };
}
async function members(orgId: string, signal?: AbortSignal): Promise<Row[]> {
  return getLiveRows(
    `/api/v1/admin/organizations/${encodeURIComponent(orgId)}/members`,
    signal,
  );
}
async function saveMembership(
  input: MembershipInput,
  editing: boolean,
): Promise<Membership> {
  const rows = editing ? await members(input.organizationId) : [];
  const previous = rows.find((r) => r.userId === input.staffId);
  if (editing && !previous)
    throw new ApiError("NOT_FOUND", 404, "Không tìm thấy thành viên.");
  const result = await liveApiJson(
    `/api/v1/admin/organizations/${encodeURIComponent(input.organizationId)}/members${previous ? `/${String(previous.id)}` : ""}`,
    rowSchema,
    {
      method: previous ? "PATCH" : "POST",
      idempotent: true,
      body: {
        userId: input.staffId,
        roleCodes: [
          input.role === "OPERATOR_SCHEDULER"
            ? "OPERATOR_OPERATIONS"
            : input.role,
        ],
        status: input.status === "active" ? "ACTIVE" : "SUSPENDED",
        reason: input.reason,
        expectedVersion: previous?.rowVersion ?? 0,
      },
    },
  );
  return membership(result);
}
export const backendMembershipRepository = {
  list: async (
    filters: { organizationId?: string; staffId?: string },
    signal?: AbortSignal,
  ): Promise<Membership[]> => {
    const organizations = filters.organizationId
      ? [{ id: filters.organizationId }]
      : await getLiveRows("/api/v1/admin/organizations", signal);
    const rows = (
      await Promise.all(organizations.map((o) => members(String(o.id), signal)))
    ).flat();
    return rows
      .filter((r) => !filters.staffId || r.userId === filters.staffId)
      .map(membership);
  },
  create: (input: MembershipInput) => saveMembership(input, false),
  update: (input: MembershipInput) => saveMembership(input, true),
};

async function enrichBookings(
  rows: Row[],
  signal?: AbortSignal,
): Promise<Row[]> {
  const trips = await Promise.all(
    [...new Set(rows.map((r) => text(r, "tripId")))].map((id) =>
      apiJson(`/api/v1/trips/${encodeURIComponent(id)}`, rowSchema, {
        signal,
        auth: false,
      }),
    ),
  );
  const map = new Map(trips.map((t) => [t.id, t]));
  return rows.map((r) => {
    const t = map.get(r.tripId);
    return {
      ...r,
      organizationId: t?.organizationId ?? r.organizationId,
      organizationName: t?.operatorName,
      routeName: t
        ? `${String(t.origin)} → ${String(t.destination)}`
        : text(r, "tripId"),
    };
  });
}
