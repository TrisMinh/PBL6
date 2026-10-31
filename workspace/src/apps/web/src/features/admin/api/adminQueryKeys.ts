import type { AdminListParams } from "@/features/admin/schemas/adminListParams.schema";

type AdminResource =
  "organizations" | "staff" | "bookings" | "payments" | "refunds";

type AdminListKey = readonly [
  "admin",
  AdminResource,
  "list",
  Readonly<AdminListParams>,
];
type AdminDetailKey = readonly ["admin", AdminResource, "detail", string];

function snapshotParams(params: AdminListParams): Readonly<AdminListParams> {
  return Object.freeze({
    ...(params.query === undefined ? {} : { query: params.query }),
    ...(params.status === undefined ? {} : { status: params.status }),
    ...(params.organizationId === undefined
      ? {}
      : { organizationId: params.organizationId }),
    page: params.page,
    pageSize: params.pageSize,
  });
}

function resourceKeys(resource: AdminResource): {
  readonly all: readonly ["admin", AdminResource];
  list: (params: AdminListParams) => AdminListKey;
  detail: (id: string) => AdminDetailKey;
} {
  return Object.freeze({
    all: Object.freeze(["admin", resource] as const),
    list: (params: AdminListParams): AdminListKey =>
      Object.freeze(["admin", resource, "list", snapshotParams(params)]),
    detail: (id: string): AdminDetailKey =>
      Object.freeze(["admin", resource, "detail", id]),
  });
}

export const adminKeys = Object.freeze({
  all: Object.freeze(["admin"] as const),
  organizations: resourceKeys("organizations"),
  staff: resourceKeys("staff"),
  bookings: resourceKeys("bookings"),
  payments: resourceKeys("payments"),
  refunds: resourceKeys("refunds"),
});
